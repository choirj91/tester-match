/**
 * 커뮤니티 테스터 마켓 — 유료 시트 (ADR-0012).
 *
 * 결제된 주문의 tester_count 만큼 "시트"가 열리고, 테스터 옵트인 시 오래된 주문부터 채운다.
 * 원칙: 완주한 시트만 과금한다.
 *   - 충원 기간 = 결제 후 7일. 그때까지 안 찬 시트는 마감(seats_closed)하고 환불.
 *   - 충원 기간 안의 이탈은 시트를 다시 열어 교체 테스터를 받는다 (1일차부터).
 *   - 충원 마감 후 이탈·이의 인용(몰수) 시트는 환불.
 *   - 크레딧 결제는 원장 자동 환급, 토스 결제는 refund_due_krw 에 쌓아 관리자가 부분취소.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureOrderSlots } from "@/lib/console-data";
import { SCREENSHOT_BUCKET } from "@/lib/console";
import { appendLedger } from "@/lib/credits";
import { fetchAll } from "@/lib/fetch-all";
import { createNotification, createNotificationsBulk } from "@/lib/notifications";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import { ATTENTION_NOTE_PREFIX, REFUND_FAILED_NOTE_PREFIX } from "@/lib/paid-order-sweep-rules";
import { SEAT_REWARD_MAX, SEAT_REWARD_SUMMARY } from "@/lib/seat-reward-rules";
import { SITE_URL } from "@/lib/site";

/** 시트당 최대 보상 (출시 보너스 포함) — 산정 규칙은 seat-reward-rules.ts */
export const PAID_SEAT_REWARD = SEAT_REWARD_MAX;
/** 한 요청에서 회수하는 스테일 슬롯 수 상한 (서브리퀘스트 예산) */
const RECLAIM_SLOTS_PER_CALL = 3;
/** 테스터 1인이 동시에 잡을 수 있는 유료 시트 상한 (어뷰징 가드) */
export const PAID_SEAT_MAX_CONCURRENT = 3;
/**
 * 유료 시트 참여는 Google 로 인증한 계정만 (ADR-0013). 테스터는 어차피 Play 스토어용 Google
 * 계정이 필요하고, 이메일 가입만으로 계정을 늘려 보상을 쌓는 것을 막는다.
 */
export const PAID_SEAT_REQUIRES_GOOGLE = true;
/** 결제 시 급구 노출 기간 */
export const PAID_SEAT_BOOST_DAYS = 14;
/** 충원 기간 — 결제 후 이 일수가 지나면 빈 시트를 마감하고 환불한다 */
export const PAID_SEAT_FILL_DAYS = 7;
export const REDEMPTION_MIN_CREDITS = 5000;
export const REDEMPTION_UNIT_CREDITS = 5000;
/** 건당 5만원 이하 — 기타소득 과세최저한 이내로 유지 */
export const REDEMPTION_MAX_CREDITS = 50000;

export const SEAT_OPEN_STATUSES = ["paid", "in_progress"] as const;
const NOTE_PREFIXES_TO_KEEP = [REFUND_FAILED_NOTE_PREFIX, ATTENTION_NOTE_PREFIX];
export const SEAT_FILLED_MATCH_STATUSES = ["active", "completed"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SeatOrder = { id: number; app_id: number; tester_count: number; created_at: string };

/** 열린 시트가 있는 가장 오래된 주문 */
export function pickOrderWithOpenSeat(
  orders: ReadonlyArray<SeatOrder>,
  filledByOrder: ReadonlyMap<number, number>,
): SeatOrder | null {
  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return sorted.find((o) => (filledByOrder.get(o.id) ?? 0) < o.tester_count) ?? null;
}

export function openSeatCount(
  orders: ReadonlyArray<SeatOrder>,
  filledByOrder: ReadonlyMap<number, number>,
): number {
  return orders.reduce(
    (sum, o) => sum + Math.max(0, o.tester_count - (filledByOrder.get(o.id) ?? 0)),
    0,
  );
}

/** 충원 마감 시각 (결제 + 7일) */
export function fillDeadline(paidAtIso: string): Date {
  return new Date(new Date(paidAtIso).getTime() + PAID_SEAT_FILL_DAYS * DAY_MS);
}

export type OrderSettlement = "open" | "completed" | "canceled";

/**
 * 주문 종결 판정. 진행 중 테스터가 있으면 열림. 전 시트 완주면 완료.
 * 시트가 마감된 뒤 진행 중이 없으면: 완주가 하나라도 있으면 완료, 없으면 취소(전액 환불 대상).
 */
export function orderSettlement(args: {
  seatsClosed: boolean;
  testerCount: number;
  active: number;
  completed: number;
}): OrderSettlement {
  if (args.active > 0) return "open";
  if (args.completed >= args.testerCount) return "completed";
  if (!args.seatsClosed) return "open";
  return args.completed > 0 ? "completed" : "canceled";
}

/** 오픈채팅 공지 텍스트 */
export function seatNoticeText(args: { appName: string; appId: number; seats: number }): string {
  return [
    `💰 유료 테스트 시트 오픈 — ${args.appName}`,
    "",
    `남은 시트 ${args.seats}명 · ${SEAT_REWARD_SUMMARY}`,
    "14일 중 12일 이상 출석하면 완주 — 구매자 확정 후 지급, 기프티콘 교환 가능.",
    "매일 앱 실행 + 체크인 + 스크린샷 1장. 리뷰·별점 작성은 금지.",
    `${SITE_URL}/browse/${args.appId}`,
  ].join("\n");
}

type SeatCounts = {
  filled: Map<number, number>;
  active: Map<number, number>;
  completed: Map<number, number>;
};

const emptySeatCounts = (): SeatCounts => ({
  filled: new Map(),
  active: new Map(),
  completed: new Map(),
});

/**
 * 주문별 시트 점유 수. 조회 실패는 null —
 * 0 으로 읽으면 채워진 시트를 빈 시트로 환불하거나 진행 중인 주문을 종결하게 된다.
 */
async function seatCounts(
  supabase: SupabaseClient,
  orderIds: number[],
): Promise<SeatCounts | null> {
  const counts = emptySeatCounts();
  if (orderIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("matches")
    .select("paid_order_id, status")
    .in("paid_order_id", orderIds)
    .in("status", [...SEAT_FILLED_MATCH_STATUSES]);
  if (error) {
    console.error("[paid-seats] seat count query failed", orderIds, error);
    return null;
  }
  for (const m of data ?? []) {
    if (m.paid_order_id == null) continue;
    counts.filled.set(m.paid_order_id, (counts.filled.get(m.paid_order_id) ?? 0) + 1);
    const bucket = m.status === "active" ? counts.active : counts.completed;
    bucket.set(m.paid_order_id, (bucket.get(m.paid_order_id) ?? 0) + 1);
  }
  return counts;
}

/** 화면 표시용 — 조회 실패 시 빈 값 (정산 판단에는 쓰지 않는다) */
export async function loadSeatCounts(
  supabase: SupabaseClient,
  orderIds: number[],
): Promise<SeatCounts> {
  return (await seatCounts(supabase, orderIds)) ?? emptySeatCounts();
}

/** 앱의 열린 시트가 있는 주문 (없으면 null) */
export async function findOpenSeatOrder(
  supabase: SupabaseClient,
  appId: number,
): Promise<SeatOrder | null> {
  const { data } = await supabase
    .from("paid_tester_orders")
    .select("id, app_id, tester_count, created_at")
    .eq("app_id", appId)
    .in("status", [...SEAT_OPEN_STATUSES])
    .eq("seats_closed", false);
  const orders = (data ?? []) as SeatOrder[];
  if (orders.length === 0) return null;
  const counts = await seatCounts(
    supabase,
    orders.map((o) => o.id),
  );
  // 점유 수를 모르면 유료 시트로 배정하지 않는다 (초과 배정 방지)
  if (!counts) return null;
  return pickOrderWithOpenSeat(orders, counts.filled);
}

/** 앱별 열린 유료 시트 수. 조회 실패는 null — "0"으로 읽으면 급구 해제 같은 판단이 틀어진다 */
export async function countOpenSeatsByApp(
  supabase: SupabaseClient,
  appIds: number[],
): Promise<Map<number, number> | null> {
  const result = new Map<number, number>();
  if (appIds.length === 0) return result;
  const { data, error } = await supabase
    .from("paid_tester_orders")
    .select("id, app_id, tester_count, created_at")
    .in("app_id", appIds)
    .in("status", [...SEAT_OPEN_STATUSES])
    .eq("seats_closed", false);
  if (error) {
    console.error("[paid-seats] open seat order query failed", error);
    return null;
  }
  const orders = (data ?? []) as SeatOrder[];
  if (orders.length === 0) return result;
  const counts = await seatCounts(
    supabase,
    orders.map((o) => o.id),
  );
  if (!counts) return null;
  const { filled } = counts;
  for (const appId of new Set(orders.map((o) => o.app_id))) {
    result.set(
      appId,
      openSeatCount(
        orders.filter((o) => o.app_id === appId),
        filled,
      ),
    );
  }
  return result;
}

/** 시트 배정 후 초과 여부 — 동시 옵트인 경합 정리용 */
export async function isOrderOverfilled(
  supabase: SupabaseClient,
  order: Pick<SeatOrder, "id" | "tester_count">,
): Promise<boolean | null> {
  const counts = await seatCounts(supabase, [order.id]);
  // 확인할 수 없으면 null — 호출부가 참여를 취소하고 다시 시도하게 한다 (조용한 강등·초과 배정 모두 방지)
  if (!counts) return null;
  return (counts.filled.get(order.id) ?? 0) > order.tester_count;
}

export async function countTesterActivePaidSeats(
  supabase: SupabaseClient,
  testerUserId: number,
): Promise<number> {
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tester_user_id", testerUserId)
    .eq("status", "active")
    .not("paid_order_id", "is", null);
  return count ?? 0;
}

/** 이 앱의 유료 시트를 한 번이라도 잡았던 테스터인지 — 같은 사람이 시트를 반복 점유하는 것을 막는다 */
export async function hasPriorPaidSeat(
  supabase: SupabaseClient,
  appId: number,
  testerUserId: number,
): Promise<boolean> {
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("app_id", appId)
    .eq("tester_user_id", testerUserId)
    .not("paid_order_id", "is", null)
    .or("opt_out_reason.is.null,opt_out_reason.neq.install_blocked");
  return (count ?? 0) > 0;
}

/** 슬롯의 증빙(스토리지 원본 + 로그)과 매칭 연결을 비운다 */
async function clearSlot(supabase: SupabaseClient, slotId: number): Promise<void> {
  const { data: logRows } = await supabase
    .from("paid_order_logs")
    .select("screenshot_path")
    .eq("slot_id", slotId);
  const paths = (logRows ?? [])
    .map((l) => l.screenshot_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(SCREENSHOT_BUCKET).remove(paths);
    if (rmErr) console.error("[paid-seats] screenshot cleanup failed", rmErr);
  }
  await supabase.from("paid_order_logs").delete().eq("slot_id", slotId);
  await supabase.from("paid_order_slots").update({ match_id: null, label: "" }).eq("id", slotId);
}

/** 이탈·탈퇴 등으로 끝난 매칭에 묶여 있는 슬롯 회수 (자가 복구 — 해제 누락이 있어도 다음 배정 때 정리) */
async function reclaimStaleSlots(supabase: SupabaseClient, orderId: number): Promise<void> {
  const { data: linked } = await supabase
    .from("paid_order_slots")
    .select("id, match_id")
    .eq("order_id", orderId)
    .not("match_id", "is", null);
  const slots = (linked ?? []) as Array<{ id: number; match_id: number }>;
  if (slots.length === 0) return;
  const { data: matches } = await supabase
    .from("matches")
    .select("id, status")
    .in(
      "id",
      slots.map((s) => s.match_id),
    );
  const live = new Set(
    (matches ?? [])
      .filter((m) => (SEAT_FILLED_MATCH_STATUSES as readonly string[]).includes(m.status))
      .map((m) => m.id),
  );
  const stale = slots.filter((s) => !live.has(s.match_id)).slice(0, RECLAIM_SLOTS_PER_CALL);
  for (const slot of stale) await clearSlot(supabase, slot.id);
}

/** 콘솔 슬롯 하나를 이 매칭에 연결 (없으면 생성). 구매자가 콘솔에서 스크린샷을 보는 경로. */
export async function assignSeatSlot(
  supabase: SupabaseClient,
  args: { orderId: number; matchId: number; label: string },
): Promise<{ slotId: number; slotNo: number } | null> {
  await ensureOrderSlots(args.orderId);
  await reclaimStaleSlots(supabase, args.orderId);
  const { data: free } = await supabase
    .from("paid_order_slots")
    .select("id, slot_no")
    .eq("order_id", args.orderId)
    .is("match_id", null)
    .order("slot_no", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!free) return null;
  const { data: updated } = await supabase
    .from("paid_order_slots")
    .update({ match_id: args.matchId, label: args.label.slice(0, 40) })
    .eq("id", free.id)
    .is("match_id", null)
    .select("id, slot_no")
    .maybeSingle();
  return updated ? { slotId: updated.id, slotNo: updated.slot_no } : null;
}

/** 급구 노출 보장 — 기존 마감이 더 늦으면 유지 */
export async function ensureBoost(supabase: SupabaseClient, appId: number): Promise<void> {
  const deadline = new Date(Date.now() + PAID_SEAT_BOOST_DAYS * DAY_MS);
  const { data: app } = await supabase
    .from("apps")
    .select("is_boost, boost_deadline_at")
    .eq("id", appId)
    .maybeSingle();
  const current = app?.boost_deadline_at ? new Date(app.boost_deadline_at) : null;
  if (app?.is_boost && current && current >= deadline) return;
  await supabase
    .from("apps")
    .update({ is_boost: true, boost_deadline_at: deadline.toISOString() })
    .eq("id", appId);
}

/** 결제 확정 직후: 급구 노출 + 전 회원 알림. 멱등 (같은 날 같은 앱 알림은 1회). */
export async function activatePaidOrder(
  supabase: SupabaseClient,
  args: { orderId: number; appId: number; appName: string; seats: number },
): Promise<void> {
  await ensureBoost(supabase, args.appId);

  const link = `/browse/${args.appId}`;
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "paid_seat_open")
    .eq("link", link)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;

  const users = await fetchAll<{ id: number }>((from, to) =>
    supabase.from("users").select("id").is("deleted_at", null).order("id").range(from, to),
  );
  await createNotificationsBulk(
    users.map((u) => u.id),
    {
      type: "paid_seat_open",
      title: `💰 유료 시트 오픈 — ${args.appName.slice(0, 40)} ${args.seats}명`,
      body: `${SEAT_REWARD_SUMMARY}. 매일 체크인 + 스크린샷 1장, 기프티콘 교환 가능. 선착순.`,
      link,
    },
  );
}

/** 크레딧으로 결제된 주문인지 — 원장의 구매 차감 행으로 판별 (payments 행 유무와 무관) */
export async function isCreditsPaidOrder(
  supabase: SupabaseClient,
  orderId: number,
): Promise<boolean | null> {
  const { count, error } = await supabase
    .from("credits_ledger")
    .select("id", { count: "exact", head: true })
    .eq("type", "spend")
    .eq("ref_type", "paid_order")
    .eq("ref_id", orderId);
  // 조회 실패를 "토스 결제"로 오판하면 환불 수단이 바뀐다 → 알 수 없음(null)으로 구분
  if (error) {
    console.error("[paid-seats] credits-paid lookup failed", orderId, error);
    return null;
  }
  return (count ?? 0) > 0;
}

export type SeatRefundResult = { mode: "credits" | "toss"; amount: number; ok: boolean };

/**
 * 시트 환불. 크레딧 결제는 원장 자동 환급(멱등키 = refType + refId), 토스 결제는 refund_due_krw 누적.
 * 호출부가 상태 전이(1회성)를 보장하므로 토스 누적도 중복되지 않는다.
 */
export async function refundSeats(
  supabase: SupabaseClient,
  args: {
    orderId: number;
    buyerUserId: number;
    seats: number;
    refType: "paid_seat_refund" | "paid_order_unfilled";
    refId: number;
    reason: string;
  },
): Promise<SeatRefundResult> {
  const amount = args.seats * PAID_TESTER_PRICE_KRW;
  if (amount <= 0) return { mode: "credits", amount: 0, ok: true };

  const creditsPaid = await isCreditsPaidOrder(supabase, args.orderId);
  if (creditsPaid === null) return { mode: "credits", amount, ok: false };
  if (creditsPaid) {
    const ledger = await appendLedger(supabase, {
      userId: args.buyerUserId,
      amount,
      type: "refund",
      refType: args.refType,
      refId: args.refId,
      description: `유료 시트 환급 — ${args.reason}`,
    });
    if (!ledger.ok) console.error("[paid-seats] seat refund failed", args.orderId, ledger.message);
    return { mode: "credits", amount, ok: ledger.ok };
  }

  // 원자적 누적 — DB CHECK(refund_due + refunded <= amount) 가 과다 환불을 막는다
  const { error } = await supabase.rpc("order_add_refund_due", {
    p_order: args.orderId,
    p_amount: amount,
  });
  if (error) console.error("[paid-seats] refund_due update failed", args.orderId, error);
  return { mode: "toss", amount, ok: !error };
}

type OrderForSettle = {
  id: number;
  app_id: number;
  buyer_user_id: number;
  tester_count: number;
  status: string;
  seats_closed: boolean;
  fulfillment: "community" | "operator";
  admin_note: string | null;
  apps: { name: string } | null;
};

async function loadOrderForSettle(
  supabase: SupabaseClient,
  orderId: number,
): Promise<OrderForSettle | null> {
  const { data } = await supabase
    .from("paid_tester_orders")
    .select(
      "id, app_id, buyer_user_id, tester_count, status, seats_closed, fulfillment, admin_note, apps(name)",
    )
    .eq("id", orderId)
    .maybeSingle<OrderForSettle>();
  return data ?? null;
}

/** 주문 종결 (멱등): 진행 중 테스터가 없고 전 시트 완주 또는 시트 마감이면 completed / canceled */
export async function settleOrderIfDone(supabase: SupabaseClient, orderId: number): Promise<void> {
  const order = await loadOrderForSettle(supabase, orderId);
  if (!order || !(SEAT_OPEN_STATUSES as readonly string[]).includes(order.status)) return;
  // 운영자 폴백 주문은 매칭이 없으므로 자동 종결하지 않는다 (관리자가 [완료])
  if (order.fulfillment === "operator") return;
  const counts = await seatCounts(supabase, [orderId]);
  // 점유 수를 모르면 판정하지 않는다 — 0 으로 읽으면 진행 중인 주문을 취소로 종결하게 된다
  if (!counts) return;
  const { active, completed } = counts;
  const decision = orderSettlement({
    seatsClosed: order.seats_closed,
    testerCount: order.tester_count,
    active: active.get(orderId) ?? 0,
    completed: completed.get(orderId) ?? 0,
  });
  if (decision === "open") return;
  // "환불 실패"·"확인 필요" 메모는 사람이 처리할 때까지 남아야 한다 — 종결 사유로 덮어쓰지 않는다
  const keepNote = NOTE_PREFIXES_TO_KEEP.some((p) => order.admin_note?.startsWith(p));
  const { error } = await supabase
    .from("paid_tester_orders")
    .update(
      decision === "completed"
        ? { status: "completed", completed_at: new Date().toISOString() }
        : {
            status: "canceled",
            ...(keepNote ? {} : { admin_note: "완주 시트 없음 — 전 시트 환불 대상으로 종결" }),
          },
    )
    .eq("id", orderId)
    .in("status", [...SEAT_OPEN_STATUSES]);
  if (error) console.error("[paid-seats] settle update failed", orderId, error);
}

/** 수동 처리가 필요한 주문에 남기는 메모 — 리포트가 이 접두어로 매일 경보를 낸다. 기존 메모 뒤에 덧붙인다. */
export async function noteRefundFailure(
  supabase: SupabaseClient,
  orderId: number,
  detail: string,
): Promise<void> {
  const { data } = await supabase
    .from("paid_tester_orders")
    .select("admin_note")
    .eq("id", orderId)
    .maybeSingle();
  const previous = data?.admin_note?.startsWith(REFUND_FAILED_NOTE_PREFIX) ? `${data.admin_note} / ` : "";
  const note = `${previous}${REFUND_FAILED_NOTE_PREFIX} — 수동 조정 필요 (${detail})`.slice(0, 500);
  const { error } = await supabase
    .from("paid_tester_orders")
    .update({ admin_note: note })
    .eq("id", orderId);
  if (error) console.error("[paid-seats] refund failure note not saved", orderId, detail, error);
}

export type CloseSeatsResult = {
  unfilled: number;
  refund: SeatRefundResult | null;
  /** 실패 시에만: 마감을 되돌렸으면 true (다시 시도 가능), false 면 마감된 채 "환불 실패" 메모가 남았다 */
  reverted?: boolean;
};

/** 마감 뒤 환불(또는 그 전 조회)에 실패했을 때: 마감을 되돌리고, 되돌리기도 실패하면 메모로 남긴다 */
async function failClose(
  supabase: SupabaseClient,
  orderId: number,
  unfilled: number,
  detail: string,
  refund?: SeatRefundResult,
): Promise<CloseSeatsResult> {
  const { error } = await supabase
    .from("paid_tester_orders")
    .update({ seats_closed: false })
    .eq("id", orderId);
  if (error) {
    // 마감된 채 환불이 빠진다 — 재시도 경로가 없으므로 메모로 남겨 매일 리포트에 올린다
    console.error("[paid-seats] close revert failed", orderId, error);
    await noteRefundFailure(supabase, orderId, detail);
  }
  return {
    unfilled,
    refund: refund ?? { mode: "credits", amount: unfilled * PAID_TESTER_PRICE_KRW, ok: false },
    reverted: !error,
  };
}

/**
 * 충원 마감: 빈 시트를 닫고 환불한다. 조건부 UPDATE(false→true) 가 1회성을 보장.
 * 마감을 먼저 걸어 새 배정을 막은 뒤 점유 수를 센다 (세는 사이에 시트가 차면 그 시트까지 환불하게 된다).
 * @returns 마감을 수행했으면 결과(refund.ok=false 면 실패), 이미 마감됐거나 대상이 아니면 null
 */
export async function closeOrderSeats(
  supabase: SupabaseClient,
  orderId: number,
  reason: string,
): Promise<CloseSeatsResult | null> {
  const { data: closed, error: flipErr } = await supabase
    .from("paid_tester_orders")
    .update({ seats_closed: true })
    .eq("id", orderId)
    .eq("seats_closed", false)
    .eq("fulfillment", "community")
    .in("status", [...SEAT_OPEN_STATUSES])
    .select("id");
  if (flipErr) {
    // 마감 자체가 기록되지 않았다 — "이미 마감됨"과 구분해 실패로 알린다 (바뀐 것이 없으므로 되돌릴 것도 없다)
    console.error("[paid-seats] close flip failed", orderId, flipErr);
    return { unfilled: 0, refund: { mode: "credits", amount: 0, ok: false }, reverted: true };
  }
  if (!closed || closed.length === 0) return null;

  const order = await loadOrderForSettle(supabase, orderId);
  const counts = order ? await seatCounts(supabase, [orderId]) : null;
  if (!order || !counts) return failClose(supabase, orderId, 0, "시트 현황 조회 실패로 마감 중단");
  const unfilled = Math.max(0, order.tester_count - (counts.filled.get(orderId) ?? 0));

  let refund: SeatRefundResult | null = null;
  if (unfilled > 0) {
    refund = await refundSeats(supabase, {
      orderId,
      buyerUserId: order.buyer_user_id,
      seats: unfilled,
      refType: "paid_order_unfilled",
      refId: orderId,
      reason,
    });
    if (!refund.ok) {
      return failClose(supabase, orderId, unfilled, `미충원 ${unfilled}시트 환불 미기록`, refund);
    }
    await createNotification({
      userId: order.buyer_user_id,
      type: "seat_issue",
      title: `미충원 시트 ${unfilled}명 마감 — 환불 처리`,
      body:
        refund.mode === "credits"
          ? `"${order.apps?.name ?? "앱"}" ${reason}. ${refund.amount.toLocaleString("ko-KR")} 크레딧이 환급되었습니다.`
          : `"${order.apps?.name ?? "앱"}" ${reason}. ${refund.amount.toLocaleString("ko-KR")}원은 영업일 3일 내 결제 수단으로 부분 취소됩니다.`,
      link: `/console/orders/${orderId}`,
    });
  }
  // 이전 시도가 남긴 "확인 필요" 메모는 마감이 성공한 지금 해소됐다 — 종결 뒤에는 스윕이 다시 오지 않으므로 여기서 지운다
  if (order.admin_note?.startsWith(ATTENTION_NOTE_PREFIX)) {
    await supabase
      .from("paid_tester_orders")
      .update({ admin_note: null })
      .eq("id", orderId)
      .like("admin_note", `${ATTENTION_NOTE_PREFIX}%`); // 그 사이 다른 메모("환불 실패")로 바뀌었으면 건드리지 않는다
  }
  await settleOrderIfDone(supabase, orderId);
  return { unfilled, refund };
}

/** 이탈 시트 환불 안내 — 환불 기록에 실패했으면 "환급됐다"고 말하지 않는다 */
function seatDropRefundBody(appName: string, refund: SeatRefundResult): string {
  const lead = `"${appName}" 시트 테스터가 완주하지 못했습니다.`;
  if (!refund.ok) return `${lead} 이 시트는 환불 대상이며 운영팀이 확인 후 처리합니다.`;
  return refund.mode === "credits"
    ? `${lead} 1,000 크레딧이 환급되었습니다.`
    : `${lead} 1,000원은 영업일 3일 내 부분 취소됩니다.`;
}

/**
 * 이탈·페널티·탈퇴로 비는 유료 시트 해제 — 슬롯·증빙 정리 + 구매자 통지. 무료 매칭이면 false.
 * 충원 기간 중이면 시트를 다시 열고, 충원 마감 후면 그 시트를 환불한다.
 * 호출자는 true 일 때 required_testers 복구를 건너뛴다 (시트는 정원을 소모하지 않았음).
 */
export async function releasePaidSeat(supabase: SupabaseClient, matchId: number): Promise<boolean> {
  const { data: match } = await supabase
    .from("matches")
    .select("paid_order_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.paid_order_id == null) return false;
  const orderId: number = match.paid_order_id;

  const { data: slot } = await supabase
    .from("paid_order_slots")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (slot) await clearSlot(supabase, slot.id);

  const order = await loadOrderForSettle(supabase, orderId);
  if (order) {
    const appName = order.apps?.name ?? "앱";
    if (order.seats_closed) {
      const refund = await refundSeats(supabase, {
        orderId,
        buyerUserId: order.buyer_user_id,
        seats: 1,
        refType: "paid_seat_refund",
        refId: matchId,
        reason: "충원 마감 후 테스터 이탈",
      });
      if (!refund.ok) await noteRefundFailure(supabase, orderId, `match ${matchId}, 1,000`);
      await createNotification({
        userId: order.buyer_user_id,
        type: "seat_issue",
        title: "테스터 이탈 — 해당 시트 환불",
        body: seatDropRefundBody(appName, refund),
        link: `/console/orders/${orderId}`,
      });
    } else {
      await createNotification({
        userId: order.buyer_user_id,
        type: "seat_issue",
        title: "테스터 교체 — 시트가 다시 열렸습니다",
        body: `"${appName}" 시트 테스터가 이탈해 교체 테스터를 모집합니다. 새 테스터는 1일차부터 시작하므로 Play Console 의 테스터 수·기간을 확인해주세요.`,
        link: `/console/orders/${orderId}`,
      });
    }
    await settleOrderIfDone(supabase, orderId);
  }
  return true;
}

export type OrderRefundResult = { kind: "credits" | "toss"; ok: boolean; message?: string };

/** 이 주문으로 이미 환급된 크레딧 합계 (주문 단위 + 시트 단위). 조회 실패는 null */
async function creditsAlreadyRefunded(
  supabase: SupabaseClient,
  orderId: number,
): Promise<number | null> {
  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("id")
    .eq("paid_order_id", orderId);
  if (matchErr) return null;
  const matchIds = (matches ?? []).map((m) => m.id);

  const [orderRows, seatRows] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("amount")
      .eq("type", "refund")
      .in("ref_type", ["paid_order", "paid_order_unfilled"])
      .eq("ref_id", orderId),
    matchIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ amount: number }>, error: null })
      : supabase
          .from("credits_ledger")
          .select("amount")
          .eq("type", "refund")
          .eq("ref_type", "paid_seat_refund")
          .in("ref_id", matchIds),
  ]);
  if (orderRows.error || seatRows.error) return null;
  return [...(orderRows.data ?? []), ...(seatRows.data ?? [])].reduce((sum, r) => sum + r.amount, 0);
}

type OrderForFullRefund = {
  id: number;
  amount_krw: number;
  refunded_krw: number | null;
  paid_at: string | null;
};

/** 토스 결제 주문: 이미 환불 완료한 금액을 뺀 나머지를 환불 대기로 올린다 (CHECK: 대기 + 완료 <= 결제 금액) */
async function markTossRefundDue(
  supabase: SupabaseClient,
  order: OrderForFullRefund,
): Promise<OrderRefundResult> {
  if (!order.paid_at) return { kind: "toss", ok: true }; // 결제된 적 없음 — 환불할 것이 없다
  const { error } = await supabase
    .from("paid_tester_orders")
    .update({ refund_due_krw: Math.max(0, order.amount_krw - (order.refunded_krw ?? 0)) })
    .eq("id", order.id);
  if (error) {
    console.error("[paid-seats] full refund_due update failed", order.id, error);
    return { kind: "toss", ok: false, message: "환불 대기 금액을 기록하지 못했습니다." };
  }
  return { kind: "toss", ok: true };
}

/**
 * 주문 전체 환불 (관리자 취소). 이미 환불된 금액을 뺀 나머지만 환불한다.
 * 크레딧 결제는 원장 환급(멱등키 = paid_order + 주문 id), 토스 결제는 refund_due_krw 에 남은 금액을 올려
 * 관리자가 토스에서 취소하도록 표시한다. 결제 수단은 원장의 차감 행으로 판별한다 (paid_at 유무와 무관 —
 * 크레딧이 차감된 채 확정되지 못한 pending 주문도 환급 대상).
 */
export async function refundCreditsOrder(
  supabase: SupabaseClient,
  orderId: number,
  reason: string,
): Promise<OrderRefundResult> {
  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("id, buyer_user_id, amount_krw, payment_id, paid_at, refunded_krw")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { kind: "toss", ok: false, message: "주문을 찾을 수 없습니다." };

  const creditsPaid = await isCreditsPaidOrder(supabase, orderId);
  if (creditsPaid === null) {
    return { kind: "toss", ok: false, message: "결제 수단을 확인하지 못했습니다. 다시 시도해주세요." };
  }
  if (!creditsPaid) return markTossRefundDue(supabase, order);

  const already = await creditsAlreadyRefunded(supabase, orderId);
  if (already === null) {
    return { kind: "credits", ok: false, message: "기존 환급 내역을 확인하지 못했습니다. 다시 시도해주세요." };
  }
  const remaining = Math.max(0, order.amount_krw - already);
  if (remaining > 0) {
    const ledger = await appendLedger(supabase, {
      userId: order.buyer_user_id,
      amount: remaining,
      type: "refund",
      refType: "paid_order",
      refId: order.id,
      description: `유료 테스터 주문 환급 — ${reason}`,
    });
    if (!ledger.ok) {
      console.error("[paid-seats] credits refund failed", orderId, ledger.message);
      return { kind: "credits", ok: false, message: ledger.message };
    }
  }
  if (order.payment_id != null) {
    await supabase
      .from("payments")
      .update({
        status: "refunded",
        refunded_amount: order.amount_krw,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", order.payment_id);
  }
  await supabase.from("paid_tester_orders").update({ status: "refunded" }).eq("id", order.id);
  return { kind: "credits", ok: true };
}
