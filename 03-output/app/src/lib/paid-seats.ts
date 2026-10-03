/**
 * 커뮤니티 테스터 마켓 — 유료 시트 (ADR-0012).
 * 결제된 주문의 tester_count 만큼 "시트"가 열리고, 테스터 옵트인 시 오래된 주문부터 채운다.
 * 시트 완주 보상 = 50원/일 × 14일 = 700 크레딧 (완주 시 일괄).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureOrderSlots } from "@/lib/console-data";
import { fetchAll } from "@/lib/fetch-all";
import { createNotificationsBulk } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";
import { appendLedger } from "@/lib/credits";

export const PAID_SEAT_DAILY_REWARD = 50;
export const PAID_SEAT_TOTAL_DAYS = 14;
export const PAID_SEAT_REWARD = PAID_SEAT_DAILY_REWARD * PAID_SEAT_TOTAL_DAYS;
/** 테스터 1인이 동시에 잡을 수 있는 유료 시트 상한 (어뷰징 가드) */
export const PAID_SEAT_MAX_CONCURRENT = 3;
/** 결제 시 급구 노출 기간 */
export const PAID_SEAT_BOOST_DAYS = 14;
export const REDEMPTION_MIN_CREDITS = 5000;
export const REDEMPTION_UNIT_CREDITS = 5000;

export const SEAT_OPEN_STATUSES = ["paid", "in_progress"] as const;
export const SEAT_FILLED_MATCH_STATUSES = ["active", "completed"] as const;

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

/** 오픈채팅 공지 텍스트 */
export function seatNoticeText(args: { appName: string; appId: number; seats: number }): string {
  return [
    `💰 유료 테스트 시트 오픈 — ${args.appName}`,
    "",
    `남은 시트 ${args.seats}명 · 14일 완주 시 ${PAID_SEAT_REWARD.toLocaleString("ko-KR")} 크레딧 (기프티콘 교환 가능)`,
    "매일 앱 실행 + 체크인 + 스크린샷 1장. 리뷰·별점 작성은 금지.",
    `${SITE_URL}/browse/${args.appId}`,
  ].join("\n");
}

async function filledCounts(
  supabase: SupabaseClient,
  orderIds: number[],
): Promise<Map<number, number>> {
  const filled = new Map<number, number>();
  if (orderIds.length === 0) return filled;
  const { data } = await supabase
    .from("matches")
    .select("paid_order_id")
    .in("paid_order_id", orderIds)
    .in("status", [...SEAT_FILLED_MATCH_STATUSES]);
  for (const m of data ?? []) {
    if (m.paid_order_id == null) continue;
    filled.set(m.paid_order_id, (filled.get(m.paid_order_id) ?? 0) + 1);
  }
  return filled;
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
  const filled = await filledCounts(
    supabase,
    orders.map((o) => o.id),
  );
  return pickOrderWithOpenSeat(orders, filled);
}

/** 앱별 열린 시트 수 (브라우즈 배지용) */
export async function countOpenSeatsByApp(
  supabase: SupabaseClient,
  appIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (appIds.length === 0) return result;
  const { data } = await supabase
    .from("paid_tester_orders")
    .select("id, app_id, tester_count, created_at")
    .in("app_id", appIds)
    .in("status", [...SEAT_OPEN_STATUSES])
    .eq("seats_closed", false);
  const orders = (data ?? []) as SeatOrder[];
  if (orders.length === 0) return result;
  const filled = await filledCounts(
    supabase,
    orders.map((o) => o.id),
  );
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
): Promise<boolean> {
  const filled = await filledCounts(supabase, [order.id]);
  return (filled.get(order.id) ?? 0) > order.tester_count;
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

/** 콘솔 슬롯 하나를 이 매칭에 연결 (없으면 생성). 구매자가 콘솔에서 스크린샷을 보는 경로. */
export async function assignSeatSlot(
  supabase: SupabaseClient,
  args: { orderId: number; matchId: number; label: string },
): Promise<{ slotId: number; slotNo: number } | null> {
  await ensureOrderSlots(args.orderId);
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

/** 결제 확정 직후: 급구 노출 + 전 회원 알림. 멱등 (같은 날 같은 앱 알림은 1회). */
export async function activatePaidOrder(
  supabase: SupabaseClient,
  args: { orderId: number; appId: number; appName: string; seats: number },
): Promise<void> {
  const deadline = new Date(Date.now() + PAID_SEAT_BOOST_DAYS * 24 * 60 * 60 * 1000);
  const { data: app } = await supabase
    .from("apps")
    .select("boost_deadline_at")
    .eq("id", args.appId)
    .maybeSingle();
  const current = app?.boost_deadline_at ? new Date(app.boost_deadline_at) : null;
  if (!current || current < deadline) {
    await supabase
      .from("apps")
      .update({ is_boost: true, boost_deadline_at: deadline.toISOString() })
      .eq("id", args.appId);
  }

  const link = `/browse/${args.appId}`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
      body: `14일 완주 시 ${PAID_SEAT_REWARD.toLocaleString("ko-KR")} 크레딧 (기프티콘 교환 가능). 매일 체크인 + 스크린샷 1장. 선착순.`,
      link,
    },
  );
}

/**
 * 이탈·페널티로 비는 유료 시트 해제 — 슬롯 연결·증빙 로그 정리. 무료 매칭이면 false.
 * 호출자는 true 일 때 required_testers 복구를 건너뛴다 (시트는 정원을 소모하지 않았음).
 */
export async function releasePaidSeat(supabase: SupabaseClient, matchId: number): Promise<boolean> {
  const { data: match } = await supabase
    .from("matches")
    .select("paid_order_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.paid_order_id == null) return false;

  const { data: slot } = await supabase
    .from("paid_order_slots")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (slot) {
    await supabase.from("paid_order_logs").delete().eq("slot_id", slot.id);
    await supabase
      .from("paid_order_slots")
      .update({ match_id: null, label: "" })
      .eq("id", slot.id);
  }
  return true;
}

/** 크레딧으로 결제된 주문의 환급 (멱등 — 부분 unique). 토스 결제면 false. */
export async function refundCreditsOrder(
  supabase: SupabaseClient,
  orderId: number,
  reason: string,
): Promise<boolean> {
  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("id, buyer_user_id, amount_krw, payment_id, payments(provider)")
    .eq("id", orderId)
    .maybeSingle<{
      id: number;
      buyer_user_id: number;
      amount_krw: number;
      payment_id: number | null;
      payments: { provider: string } | null;
    }>();
  if (!order || order.payments?.provider !== "credits") return false;

  const ledger = await appendLedger(supabase, {
    userId: order.buyer_user_id,
    amount: order.amount_krw,
    type: "refund",
    refType: "paid_order",
    refId: order.id,
    description: `유료 테스터 주문 환급 — ${reason}`,
  });
  if (!ledger.ok) {
    console.error("[paid-seats] credits refund failed", orderId, ledger.message);
    return false;
  }
  if (order.payment_id != null) {
    await supabase
      .from("payments")
      .update({ status: "refunded", refunded_amount: order.amount_krw, refunded_at: new Date().toISOString() })
      .eq("id", order.payment_id);
  }
  await supabase
    .from("paid_tester_orders")
    .update({ status: "refunded" })
    .eq("id", order.id);
  return true;
}
