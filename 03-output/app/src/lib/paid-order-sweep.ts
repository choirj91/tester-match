/**
 * 유료 주문 스윕 (ADR-0012 부록 B) — 주문이 끼지 않게 하고, 사람이 처리할 일을 모아 알린다.
 *
 *  runSweepStep : 한 번에 조금씩 처리 (Cloudflare 요청당 서브리퀘스트 상한). more=true 면 다시 호출.
 *    1. 미결제 24시간 경과: 토스에 결제가 있으면 복구, 없으면 취소 (크레딧 차감분은 먼저 환급)
 *    2. 결제 7일 경과: 빈 시트 마감 + 환불 / 열린 시트가 있으면 급구 유지 / 진행 중이 없으면 종결
 *  리포트(진행 주문 표·운영 경보·환불 대사)는 lib/paid-order-report.ts.
 *
 * 처리한 주문은 swept_at 을 찍어 20시간 동안 다시 잡지 않는다 — 막힌 주문 하나가 나머지를 굶기지 않는다.
 * 자동으로 풀 수 없는 건은 admin_note 에 "확인 필요:" 를 남겨 매일 리포트에 다시 올린다.
 * 대상 조회가 실패하면 빈 결과로 넘기지 않고 예외를 던진다 (크론 잡이 실패로 보이게).
 * 판정 규칙은 lib/paid-order-sweep-rules.ts (순수 함수). 전 단계 멱등.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { appendLedger } from "@/lib/credits";
import { confirmPaidTesterOrder } from "@/lib/paid-orders";
import {
  attentionNote,
  decidePendingOrder,
  hasAttentionNote,
  resweepFilter,
} from "@/lib/paid-order-sweep-rules";
import {
  SEAT_OPEN_STATUSES,
  closeOrderSeats,
  ensureBoost,
  fillDeadline,
  isCreditsPaidOrder,
  settleOrderIfDone,
} from "@/lib/paid-seats";
import { lookupTossPaymentByOrderId } from "@/lib/toss";

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_EXPIRY_MS = DAY_MS;
const RESWEEP_AFTER_MS = 20 * 60 * 60 * 1000;
const PENDING_PER_STEP = 2;
const ORDERS_PER_STEP = 2;

export type SweepStepResult = {
  pendingHandled: number;
  ordersHandled: number;
  autoCanceledCount: number;
  recoveredCount: number;
  closedOrders: number;
  alerts: string[];
  more: boolean;
};

type PendingOrder = {
  id: number;
  order_code: string;
  buyer_user_id: number;
  amount_krw: number;
  admin_note: string | null;
};

export type OpenOrder = {
  id: number;
  order_code: string;
  app_id: number;
  tester_count: number;
  status: string;
  paid_at: string | null;
  seats_closed: boolean;
  fulfillment: "community" | "operator";
  admin_note: string | null;
  apps: { name: string; status: string } | null;
};

type PendingOutcome = "recovered" | "canceled" | "held" | "skipped";
export type QueryResult<T> = { data: T[] | null; error: unknown };

export const OPEN_ORDER_SELECT =
  "id, order_code, app_id, tester_count, status, paid_at, seats_closed, fulfillment, admin_note, apps(name, status)";

export const won = (n: number): string => n.toLocaleString("ko-KR");

/** 스윕 대상 조회 — 실패를 "대상 없음"으로 읽으면 마감·환불이 조용히 멈춘다 → 예외 */
function rowsOrThrow<T>(result: QueryResult<T>, label: string): T[] {
  if (result.error) {
    console.error(`[paid-order-sweep] ${label} query failed`, result.error);
    throw new Error(`${label} 조회 실패`);
  }
  return result.data ?? [];
}

/** 자동 처리 불가 — 사유를 남기고 다음 날 다시 본다 */
async function holdOrder(
  supabase: SupabaseClient,
  orderId: number,
  now: Date,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("paid_tester_orders")
    .update({ swept_at: now.toISOString(), admin_note: attentionNote(reason) })
    .eq("id", orderId);
  // 기록이 안 되면 같은 주문이 매 호출 맨 앞에 잡힌다 → 잡을 실패시켜 사람이 보게 한다
  if (error) {
    console.error("[paid-order-sweep] hold failed", orderId, error);
    throw new Error(`주문 ${orderId} 보류 기록 실패`);
  }
}

/** 토스엔 승인돼 있는데 우리 쪽 반영이 빠진 주문 → 확정 */
async function recoverPending(
  supabase: SupabaseClient,
  order: PendingOrder,
  paymentKey: string,
  now: Date,
  alerts: string[],
): Promise<PendingOutcome> {
  const result = await confirmPaidTesterOrder({
    paymentKey,
    orderId: order.order_code,
    amount: order.amount_krw,
  });
  if (!result.ok) {
    await holdOrder(supabase, order.id, now, `토스엔 승인돼 있으나 반영 실패 (${result.message})`);
    alerts.push(`결제 복구 실패: ${order.order_code} — 토스엔 승인돼 있습니다. 수동 확인 필요.`);
    return "held";
  }
  if (hasAttentionNote(order.admin_note)) {
    await supabase.from("paid_tester_orders").update({ admin_note: null }).eq("id", order.id);
  }
  alerts.push(`결제 복구: ${order.order_code} — 승인됐으나 반영 누락이던 주문을 확정했습니다.`);
  return "recovered";
}

/**
 * 미결제 주문 취소. 크레딧이 차감된 채 확정되지 않은 주문이면 환급을 먼저 하고(멱등) 그다음 취소한다 —
 * 환급이 실패하면 주문은 pending 으로 남아 다음 스윕이 다시 시도한다 (되돌리기 불필요).
 */
async function cancelPending(
  supabase: SupabaseClient,
  order: PendingOrder,
  now: Date,
  alerts: string[],
): Promise<PendingOutcome> {
  const creditsPaid = await isCreditsPaidOrder(supabase, order.id);
  if (creditsPaid === null) {
    await holdOrder(supabase, order.id, now, "크레딧 결제 여부 조회 실패 — 다음 스윕 재시도");
    return "held";
  }
  if (creditsPaid) {
    const refund = await appendLedger(supabase, {
      userId: order.buyer_user_id,
      amount: order.amount_krw,
      type: "refund",
      refType: "paid_order",
      refId: order.id,
      description: "주문 미확정 자동 환급",
    });
    if (!refund.ok) {
      await holdOrder(supabase, order.id, now, `크레딧 환급 실패 (${refund.message}) — 다음 스윕 재시도`);
      alerts.push(`크레딧 환급 실패: ${order.order_code} — 주문을 취소하지 않았습니다. 다음 스윕에서 재시도.`);
      return "held";
    }
    if (!refund.duplicate) {
      alerts.push(
        `크레딧 환급: ${order.order_code} — 차감 후 확정되지 않은 주문 ${won(order.amount_krw)} 크레딧 환급.`,
      );
    }
  }

  const moved = rowsOrThrow(
    await supabase
      .from("paid_tester_orders")
      .update({
        status: "canceled",
        admin_note: "자동 취소 — 24시간 미결제",
        swept_at: now.toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending")
      .select("id"),
    "미결제 주문 취소",
  );
  return moved.length === 0 ? "skipped" : "canceled";
}

async function sweepOnePending(
  supabase: SupabaseClient,
  order: PendingOrder,
  now: Date,
  alerts: string[],
): Promise<PendingOutcome> {
  // 카드는 승인됐는데 우리 쪽 반영이 누락된 주문일 수 있다 → 토스에 먼저 확인
  const lookup = await lookupTossPaymentByOrderId(order.order_code);
  const decision = decidePendingOrder(lookup, order.amount_krw);
  if (decision.action === "hold") {
    await holdOrder(supabase, order.id, now, decision.reason);
    alerts.push(`결제 대조 필요: ${order.order_code} — ${decision.reason}. 자동 취소하지 않았습니다.`);
    return "held";
  }
  if (decision.action === "recover") {
    return recoverPending(supabase, order, decision.paymentKey, now, alerts);
  }
  return cancelPending(supabase, order, now, alerts);
}

async function sweepPending(
  supabase: SupabaseClient,
  now: Date,
  alerts: string[],
): Promise<{ handled: number; canceled: number; recovered: number }> {
  const orders = rowsOrThrow<PendingOrder>(
    await supabase
      .from("paid_tester_orders")
      .select("id, order_code, buyer_user_id, amount_krw, admin_note")
      .eq("status", "pending")
      .lt("created_at", new Date(now.getTime() - PENDING_EXPIRY_MS).toISOString())
      .or(resweepFilter(now, RESWEEP_AFTER_MS))
      .order("created_at", { ascending: true })
      .limit(PENDING_PER_STEP),
    "미결제 주문",
  );
  let handled = 0;
  let canceled = 0;
  let recovered = 0;
  for (const order of orders) {
    const outcome = await sweepOnePending(supabase, order, now, alerts);
    handled++;
    if (outcome === "canceled") canceled++;
    if (outcome === "recovered") {
      recovered++;
      // 복구는 시트 오픈 알림까지 보내 서브리퀘스트가 크다 — 한 호출에 한 건만
      break;
    }
  }
  return { handled, canceled, recovered };
}

async function sweepOneOpen(
  supabase: SupabaseClient,
  order: OpenOrder,
  now: Date,
  alerts: string[],
): Promise<{ closed: boolean; note: string | null | undefined }> {
  const appName = order.apps?.name ?? `앱 #${order.app_id}`;
  const community = order.fulfillment === "community";
  const deadlinePassed = order.paid_at != null && fillDeadline(order.paid_at) <= now;
  // undefined = 메모 유지, null = "확인 필요" 해제
  const cleared = hasAttentionNote(order.admin_note) ? null : undefined;

  if (community && !order.seats_closed && deadlinePassed) {
    const result = await closeOrderSeats(supabase, order.id, "결제 후 7일 충원 기간이 끝났습니다");
    if (!result) {
      await settleOrderIfDone(supabase, order.id);
      return { closed: false, note: cleared };
    }
    if (result.refund && !result.refund.ok) {
      alerts.push(
        `환불 기록 실패: "${appName}" (${order.order_code}) — 미충원 ${result.unfilled}시트. 다음 스윕에서 재시도.`,
      );
      // closeOrderSeats 가 남긴 "환불 실패" 메모가 있으면 그대로 둔다
      return { closed: false, note: undefined };
    }
    if (result.unfilled > 0 && result.refund) {
      alerts.push(
        result.refund.mode === "toss"
          ? `환불 필요: "${appName}" (${order.order_code}) 미충원 ${result.unfilled}시트 — 토스에서 ${won(result.refund.amount)}원 부분취소 후 [환불 완료] 처리.`
          : `자동 환급: "${appName}" (${order.order_code}) 미충원 ${result.unfilled}시트 — ${won(result.refund.amount)} 크레딧 환급됨.`,
      );
    }
    // closeOrderSeats 가 종결 판정까지 수행한다
    return { closed: true, note: cleared };
  }

  if (community && !order.seats_closed && order.apps?.status === "matching") {
    await ensureBoost(supabase, order.app_id);
  }
  await settleOrderIfDone(supabase, order.id);
  return { closed: false, note: cleared };
}

async function sweepOpenOrders(
  supabase: SupabaseClient,
  now: Date,
  alerts: string[],
): Promise<{ handled: number; closed: number; more: boolean }> {
  // 최근 20시간 안에 스윕하지 않은 주문만, 오래 안 본 순서로 — 실행마다 몇 건씩 순환
  const result = await supabase
    .from("paid_tester_orders")
    .select(OPEN_ORDER_SELECT, { count: "exact" })
    .in("status", [...SEAT_OPEN_STATUSES])
    .or(resweepFilter(now, RESWEEP_AFTER_MS))
    .order("swept_at", { ascending: true, nullsFirst: true })
    .limit(ORDERS_PER_STEP);
  const orders = rowsOrThrow(result, "열린 주문") as unknown as OpenOrder[];

  let closed = 0;
  let stamped = 0;
  for (const order of orders) {
    const outcome = await sweepOneOpen(supabase, order, now, alerts);
    if (outcome.closed) closed++;
    const { error } = await supabase
      .from("paid_tester_orders")
      .update({
        swept_at: now.toISOString(),
        ...(outcome.note === undefined ? {} : { admin_note: outcome.note }),
      })
      .eq("id", order.id);
    if (error) console.error("[paid-order-sweep] swept_at update failed", order.id, error);
    else stamped++;
  }
  // 기록에 실패한 주문은 다음 호출에 또 잡힌다 — 진전이 없으면 반복을 멈춘다
  return {
    handled: orders.length,
    closed,
    more: stamped > 0 && (result.count ?? 0) > orders.length,
  };
}

/** 스윕 한 단계. 미결제 건이 있으면 그것만, 없으면 열린 주문 몇 건을 처리한다. */
export async function runSweepStep(supabase: SupabaseClient, now: Date): Promise<SweepStepResult> {
  const alerts: string[] = [];
  const pending = await sweepPending(supabase, now, alerts);
  if (pending.handled > 0) {
    // 처리한 건은 상태가 바뀌거나 swept_at 이 찍혀 다음 호출에서 빠진다 → 반드시 끝난다
    return {
      pendingHandled: pending.handled,
      ordersHandled: 0,
      autoCanceledCount: pending.canceled,
      recoveredCount: pending.recovered,
      closedOrders: 0,
      alerts,
      more: true,
    };
  }
  const open = await sweepOpenOrders(supabase, now, alerts);
  return {
    pendingHandled: 0,
    ordersHandled: open.handled,
    autoCanceledCount: 0,
    recoveredCount: 0,
    closedOrders: open.closed,
    alerts,
    more: open.more,
  };
}
