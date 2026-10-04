/**
 * 유료 주문 일일 리포트 (읽기 전용) — 진행 주문 표 + 운영 경보 + 환불 대사.
 * 경보는 전부 "지금 상태"에서 계산한다 — 처리될 때까지 매일 다시 뜬다.
 * 조회가 실패한 항목은 조용히 비우지 않고 "확인하지 못했다"는 경보를 낸다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATTENTION_NOTE_PREFIX,
  REFUND_FAILED_NOTE_PREFIX,
  expectedRefundKrw,
  won,
} from "@/lib/paid-order-sweep-rules";
import { OPEN_ORDER_SELECT, type OpenOrder, type QueryResult } from "@/lib/paid-order-sweep";
import { SEAT_FILLED_MATCH_STATUSES, SEAT_OPEN_STATUSES } from "@/lib/paid-seats";

const DAY_MS = 24 * 60 * 60 * 1000;
const REDEMPTION_SLA_MS = 3 * DAY_MS;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ID_LIST_LIMIT = 300;
const REPORT_ORDER_LIMIT = 200;
/** 대사 대상 주문 수 — 주문당 시트 30개 기준으로 PostgREST 1,000행 상한 안에 들어오게 잡는다 */
const RECONCILE_ORDER_LIMIT = 30;
const RECONCILE_ROW_CAP = 1000;
/** 환불 대사 시작점 — 마켓 모델(완주한 시트만 과금) 이전의 샌드박스 주문은 제외 (KST 2026-10-04 00:00) */
const RECONCILE_SINCE_ISO = "2026-10-03T15:00:00.000Z";

export type OrderReportRow = {
  orderCode: string;
  appName: string;
  testerCount: number;
  status: string;
  dayN: number | null;
  activeMatches: number;
  checkedInToday: number;
};

type ClosedOrder = {
  id: number;
  order_code: string;
  status: string;
  tester_count: number;
  amount_krw: number;
  fulfillment: "community" | "operator";
  refund_due_krw: number;
  refunded_krw: number;
};

/** 리포트용 조회 — 실패하면 경보를 남기고 null (그 항목만 건너뛴다) */
function rowsOrAlert<T>(result: QueryResult<T>, label: string, alerts: string[]): T[] | null {
  if (result.error) {
    console.error(`[paid-order-report] ${label} query failed`, result.error);
    alerts.push(`리포트 조회 실패: ${label} — 이 항목은 확인하지 못했습니다. 관리자 화면에서 직접 확인.`);
    return null;
  }
  return result.data ?? [];
}

function kstDayStartIso(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS,
  ).toISOString();
}

/** 주문별 채워진 시트 수와 오늘(KST) 체크인 수 */
async function loadSeatActivity(
  supabase: SupabaseClient,
  orderIds: number[],
  now: Date,
  alerts: string[],
): Promise<{ filled: Map<number, number>; checkedToday: Map<number, number> }> {
  const filled = new Map<number, number>();
  const checkedToday = new Map<number, number>();
  const matches = rowsOrAlert(
    await supabase
      .from("matches")
      .select("id, paid_order_id")
      .in("paid_order_id", orderIds)
      .in("status", [...SEAT_FILLED_MATCH_STATUSES]),
    "시트 참여 현황",
    alerts,
  );
  const orderByMatch = new Map<number, number>();
  for (const m of matches ?? []) {
    if (m.paid_order_id == null) continue;
    orderByMatch.set(m.id, m.paid_order_id);
    filled.set(m.paid_order_id, (filled.get(m.paid_order_id) ?? 0) + 1);
  }
  if (orderByMatch.size === 0) return { filled, checkedToday };

  const checkins = rowsOrAlert(
    await supabase
      .from("checkins")
      .select("match_id")
      .in("match_id", [...orderByMatch.keys()])
      .gte("checked_in_at", kstDayStartIso(now)),
    "오늘 체크인",
    alerts,
  );
  for (const c of checkins ?? []) {
    const orderId = orderByMatch.get(c.match_id);
    if (orderId != null) checkedToday.set(orderId, (checkedToday.get(orderId) ?? 0) + 1);
  }
  return { filled, checkedToday };
}

/** 리포트 표: 진행 주문별 충원·오늘 체크인 현황 */
async function buildReportRows(
  supabase: SupabaseClient,
  now: Date,
  alerts: string[],
): Promise<OrderReportRow[]> {
  const open = (rowsOrAlert(
    await supabase
      .from("paid_tester_orders")
      .select(OPEN_ORDER_SELECT)
      .in("status", [...SEAT_OPEN_STATUSES])
      .order("created_at", { ascending: true })
      .limit(REPORT_ORDER_LIMIT),
    "진행 주문",
    alerts,
  ) ?? []) as unknown as OpenOrder[];
  if (open.length === 0) return [];

  const { filled, checkedToday } = await loadSeatActivity(
    supabase,
    open.map((o) => o.id),
    now,
    alerts,
  );

  return open.map((o) => {
    const appName = o.apps?.name ?? `앱 #${o.app_id}`;
    if (o.fulfillment === "community" && !o.seats_closed && o.apps?.status !== "matching") {
      alerts.push(
        `비모집 앱: "${appName}" (${o.order_code}) 상태가 ${o.apps?.status ?? "?"} — 시트가 열려 있지만 참여할 수 없습니다. 구매자 확인 또는 [시트 마감].`,
      );
    }
    const dayN = o.paid_at
      ? Math.min(Math.floor((now.getTime() - new Date(o.paid_at).getTime()) / DAY_MS) + 1, 99)
      : null;
    const status =
      o.fulfillment === "operator" ? "운영자 처리" : o.seats_closed ? "충원 마감·진행" : "충원 중";
    return {
      orderCode: o.order_code,
      appName,
      testerCount: o.tester_count,
      status,
      dayN,
      activeMatches: filled.get(o.id) ?? 0,
      checkedInToday: checkedToday.get(o.id) ?? 0,
    };
  });
}

/** 경보: 토스 환불 대기, 환불 실패·확인 필요 메모가 붙은 주문 */
async function orderAlerts(supabase: SupabaseClient, alerts: string[]): Promise<void> {
  const [refundDue, refundFailed, needsAttention] = await Promise.all([
    supabase.from("paid_tester_orders").select("order_code, refund_due_krw").gt("refund_due_krw", 0),
    supabase
      .from("paid_tester_orders")
      .select("order_code, admin_note")
      .like("admin_note", `${REFUND_FAILED_NOTE_PREFIX}%`),
    supabase
      .from("paid_tester_orders")
      .select("order_code, admin_note")
      .like("admin_note", `${ATTENTION_NOTE_PREFIX}%`),
  ]);
  const due = rowsOrAlert(refundDue, "토스 환불 대기", alerts) ?? [];
  if (due.length > 0) {
    const total = due.reduce((sum, o) => sum + o.refund_due_krw, 0);
    alerts.push(
      `토스 환불 대기 ${due.length}건 · ${won(total)}원 (${due.map((o) => o.order_code).join(", ")}) — 토스 대시보드에서 부분취소 후 [환불 완료].`,
    );
  }
  const noted = [
    ...(rowsOrAlert(refundFailed, "환불 실패 주문", alerts) ?? []),
    ...(rowsOrAlert(needsAttention, "확인 필요 주문", alerts) ?? []),
  ];
  for (const o of noted) alerts.push(`${o.order_code}: ${o.admin_note}`);
}

/** 경보: 사람이 처리해야 하는 대기열 (이의 판정, 기프티콘 교환) */
async function queueAlerts(supabase: SupabaseClient, now: Date, alerts: string[]): Promise<void> {
  const overdueBefore = new Date(now.getTime() - DAY_MS).toISOString();
  const [disputed, overdue, redemptions] = await Promise.all([
    supabase.from("seat_rewards").select("id").eq("status", "disputed").limit(ID_LIST_LIMIT),
    supabase
      .from("seat_rewards")
      .select("id")
      .eq("status", "held")
      .lte("release_due_at", overdueBefore)
      .limit(ID_LIST_LIMIT),
    supabase
      .from("credit_redemptions")
      .select("id, created_at")
      .eq("status", "requested")
      .order("created_at", { ascending: true }),
  ]);
  const disputes = rowsOrAlert(disputed, "보상 이의", alerts) ?? [];
  if (disputes.length > 0) {
    alerts.push(
      `보상 이의 검토 ${disputes.length}건 — 7일 내 판정하지 않으면 테스터에게 자동 지급됩니다 (/admin/seat-rewards).`,
    );
  }
  const late = rowsOrAlert(overdue, "자동 확정 지연", alerts) ?? [];
  if (late.length > 0) {
    alerts.push(
      `자동 확정 지연 ${late.length}건 — 확정 기한이 하루 넘게 지났는데 지급되지 않았습니다. GitHub Actions 의 시트 보상 크론 로그 확인.`,
    );
  }
  const waiting = rowsOrAlert(redemptions, "기프티콘 교환 대기", alerts) ?? [];
  if (waiting.length > 0) {
    const overdue = now.getTime() - new Date(waiting[0].created_at).getTime() > REDEMPTION_SLA_MS;
    alerts.push(
      `기프티콘 교환 대기 ${waiting.length}건${overdue ? " — 영업일 3일 약속 초과!" : ""} (/admin/redemptions).`,
    );
  }
}

/** 경보: 끝난 매칭에 묶인 슬롯 */
async function staleSlotAlert(supabase: SupabaseClient, alerts: string[]): Promise<void> {
  const slots = (rowsOrAlert(
    await supabase
      .from("paid_order_slots")
      .select("id, match_id")
      .not("match_id", "is", null)
      .order("id", { ascending: false })
      .limit(ID_LIST_LIMIT),
    "시트 슬롯",
    alerts,
  ) ?? []) as Array<{ id: number; match_id: number }>;
  if (slots.length === 0) return;

  const live = rowsOrAlert(
    await supabase
      .from("matches")
      .select("id")
      .in(
        "id",
        slots.map((s) => s.match_id),
      )
      .in("status", [...SEAT_FILLED_MATCH_STATUSES]),
    "슬롯 매칭 상태",
    alerts,
  );
  if (!live) return;
  const liveIds = new Set(live.map((m) => m.id));
  const stale = slots.filter((s) => !liveIds.has(s.match_id)).length;
  if (stale > 0) {
    alerts.push(`스테일 슬롯 ${stale}개 — 끝난 매칭에 묶인 슬롯 (다음 시트 배정 때 자동 회수).`);
  }
}

/** 경보: 완주했는데 보상 레코드가 없는 시트 */
async function missingHoldAlert(supabase: SupabaseClient, alerts: string[]): Promise<void> {
  const completedIds = (
    rowsOrAlert(
      await supabase
        .from("matches")
        .select("id")
        .eq("status", "completed")
        .not("paid_order_id", "is", null)
        .order("id", { ascending: false })
        .limit(ID_LIST_LIMIT),
      "완주 시트",
      alerts,
    ) ?? []
  ).map((m) => m.id);
  if (completedIds.length === 0) return;

  const rewards = rowsOrAlert(
    await supabase.from("seat_rewards").select("match_id").in("match_id", completedIds),
    "시트 보상",
    alerts,
  );
  if (!rewards) return;
  const have = new Set(rewards.map((r) => r.match_id));
  const missing = completedIds.filter((id) => !have.has(id)).length;
  if (missing > 0) alerts.push(`보상 레코드 없는 완주 시트 ${missing}건 — 6시간 크론이 자동 보정.`);
}

type SeatFacts = {
  creditsPaid: Set<number>;
  completed: Map<number, number>;
  forfeited: Map<number, number>;
  /** 시트 단위 환불이 걸릴 수 있는 매칭(이탈·몰수) → 주문 */
  refundableMatchOrder: Map<number, number>;
};

/** 대사에 필요한 주문별 사실: 결제 수단, 완주·몰수 시트 수, 시트 환불 대상 매칭 */
async function loadSeatFacts(supabase: SupabaseClient, orderIds: number[]): Promise<SeatFacts | null> {
  const [spends, matches, forfeits] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("ref_id")
      .eq("type", "spend")
      .eq("ref_type", "paid_order")
      .in("ref_id", orderIds),
    supabase
      .from("matches")
      .select("id, paid_order_id, status")
      .in("paid_order_id", orderIds)
      .neq("status", "active")
      .limit(RECONCILE_ROW_CAP),
    supabase
      .from("seat_rewards")
      .select("order_id, match_id")
      .in("order_id", orderIds)
      .eq("status", "forfeited"),
  ]);
  if (spends.error || matches.error || forfeits.error) return null;
  // 행 상한에 걸리면 완주 수를 적게 세어 거짓 경보가 난다 → 대사 포기
  if ((matches.data ?? []).length >= RECONCILE_ROW_CAP) return null;

  const facts: SeatFacts = {
    creditsPaid: new Set((spends.data ?? []).map((r) => r.ref_id)),
    completed: new Map(),
    forfeited: new Map(),
    refundableMatchOrder: new Map(),
  };
  for (const m of matches.data ?? []) {
    if (m.paid_order_id == null) continue;
    if (m.status === "completed") {
      facts.completed.set(m.paid_order_id, (facts.completed.get(m.paid_order_id) ?? 0) + 1);
    } else {
      facts.refundableMatchOrder.set(m.id, m.paid_order_id);
    }
  }
  for (const f of forfeits.data ?? []) {
    facts.forfeited.set(f.order_id, (facts.forfeited.get(f.order_id) ?? 0) + 1);
    facts.refundableMatchOrder.set(f.match_id, f.order_id);
  }
  return facts;
}

/** 크레딧 결제 주문별 원장 환급 합계 (주문 단위 + 시트 단위) */
async function loadCreditRefunds(
  supabase: SupabaseClient,
  orderIds: number[],
  matchOrder: Map<number, number>,
): Promise<Map<number, number> | null> {
  const sums = new Map<number, number>();
  if (orderIds.length === 0) return sums;
  const matchIds = [...matchOrder.keys()];
  const [orderRows, seatRows] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("ref_id, amount")
      .eq("type", "refund")
      .in("ref_type", ["paid_order", "paid_order_unfilled"])
      .in("ref_id", orderIds),
    matchIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ ref_id: number; amount: number }>, error: null })
      : supabase
          .from("credits_ledger")
          .select("ref_id, amount")
          .eq("type", "refund")
          .eq("ref_type", "paid_seat_refund")
          .in("ref_id", matchIds),
  ]);
  if (orderRows.error || seatRows.error) return null;
  for (const r of orderRows.data ?? []) sums.set(r.ref_id, (sums.get(r.ref_id) ?? 0) + r.amount);
  for (const r of seatRows.data ?? []) {
    const orderId = matchOrder.get(r.ref_id);
    if (orderId != null) sums.set(orderId, (sums.get(orderId) ?? 0) + r.amount);
  }
  return sums;
}

/**
 * 환불 대사 — 끝난 주문의 기록된 환불이 "과금 대상이 아닌 시트 × 단가"와 다르면 경보 (누락·과다 모두).
 * 토스 결제는 refund_due + refunded, 크레딧 결제는 원장 환급 합계와 비교한다.
 */
async function reconcileRefunds(supabase: SupabaseClient, alerts: string[]): Promise<void> {
  const orders = rowsOrAlert<ClosedOrder>(
    await supabase
      .from("paid_tester_orders")
      .select("id, order_code, status, tester_count, amount_krw, fulfillment, refund_due_krw, refunded_krw")
      .in("status", ["canceled", "completed", "refunded"])
      .gte("paid_at", RECONCILE_SINCE_ISO)
      .order("id", { ascending: false })
      .limit(RECONCILE_ORDER_LIMIT),
    "환불 대사 대상 주문",
    alerts,
  );
  if (!orders || orders.length === 0) return;

  const facts = await loadSeatFacts(
    supabase,
    orders.map((o) => o.id),
  );
  const creditRefunds = facts
    ? await loadCreditRefunds(
        supabase,
        orders.filter((o) => facts.creditsPaid.has(o.id)).map((o) => o.id),
        facts.refundableMatchOrder,
      )
    : null;
  if (!facts || !creditRefunds) {
    alerts.push("환불 대사 조회 실패 — 이번 리포트에서는 환불 누락·과다를 확인하지 못했습니다.");
    return;
  }

  for (const o of orders) {
    const expected = expectedRefundKrw(o, {
      completed: facts.completed.get(o.id) ?? 0,
      forfeited: facts.forfeited.get(o.id) ?? 0,
    });
    const credits = facts.creditsPaid.has(o.id);
    const recorded = credits ? (creditRefunds.get(o.id) ?? 0) : o.refund_due_krw + o.refunded_krw;
    if (recorded === expected) continue;
    const unit = credits ? "크레딧" : "원";
    alerts.push(
      `환불 ${recorded < expected ? "누락" : "과다"} 의심: ${o.order_code} — 환불 대상 ${won(expected)}${unit}인데 기록은 ${won(recorded)}${unit}. 주문 관리에서 확인.`,
    );
  }
}

/** 진행 주문 표 + 운영 경보 (읽기 전용) */
export async function buildOrderReport(
  supabase: SupabaseClient,
  now: Date,
): Promise<{ rows: OrderReportRow[]; alerts: string[] }> {
  const alerts: string[] = [];
  const rows = await buildReportRows(supabase, now, alerts);
  await orderAlerts(supabase, alerts);
  await queueAlerts(supabase, now, alerts);
  await staleSlotAlert(supabase, alerts);
  await missingHoldAlert(supabase, alerts);
  await reconcileRefunds(supabase, alerts);
  return { rows, alerts };
}
