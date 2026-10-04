/**
 * 유료 주문 스윕 (ADR-0012 부록 B) — 주문이 끼지 않게 하고, 사람이 처리할 일을 모아 알린다.
 *
 *  runSweepStep : 한 번에 조금씩 처리 (Cloudflare 요청당 서브리퀘스트 상한). more=true 면 다시 호출.
 *    1. 미결제 24시간 경과: 포트원에 결제가 있으면 복구, 없으면 취소 (크레딧 차감분은 먼저 환급)
 *    2. 결제 7일 경과: 빈 시트 마감 + 환불 / 열린 시트가 있으면 급구 유지 / 진행 중이 없으면 종결
 *    3. 결제 대조 (1·2 가 아무것도 처리하지 않은 단계에서만 — 요청당 서브리퀘스트 상한 50):
 *       a. 만료 전(15분~24시간) 미결제 주문: 결제 완료 + 검증 통과면 확정(복구), 그 외에는 swept_at 만 찍는다.
 *          단계당 5건, 같은 주문은 20시간 안에 다시 조회하지 않는다. 5건을 꽉 채웠으면 more=true.
 *       b. 결제 기록 없이 취소된 최근 14일 주문 중 최신 5건: 결제가 들어와 있으면 "확인 필요"(환불 대상) 메모.
 *          a 가 끝난 단계에서 한 번만 돈다. "조회했음"을 남길 열이 없어 more 에 반영하지 않는다
 *          (swept_at 은 자동 취소 시각으로 쓰여 일일 리포트의 자동 취소 건수를 센다 — 다시 찍으면 건수가 부푼다).
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
  AUTO_CANCEL_NOTE_PREFIX,
  REFUND_FAILED_NOTE_PREFIX,
  attentionNote,
  decideCanceledOrderCheck,
  decideEarlyRecovery,
  decidePendingOrder,
  hasAttentionNote,
  hasPaidAfterCancelNote,
  reconcileHasMore,
  resweepFilter,
  won,
} from "@/lib/paid-order-sweep-rules";
import {
  SEAT_OPEN_STATUSES,
  closeOrderSeats,
  ensureBoost,
  fillDeadline,
  isCreditsPaidOrder,
  settleOrderIfDone,
} from "@/lib/paid-seats";
import { expectedPortOnePayment, lookupPortOnePayment } from "@/lib/portone";

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_EXPIRY_MS = DAY_MS;
const RESWEEP_AFTER_MS = 20 * 60 * 60 * 1000;
const PENDING_PER_STEP = 2;
const ORDERS_PER_STEP = 2;
const EARLY_RECOVERY_MIN_AGE_MS = 15 * 60 * 1000;
const CANCELED_CHECK_WINDOW_MS = 14 * DAY_MS;
/**
 * 결제 대조 패스가 한 단계(요청 한 번)에 조회하는 주문 수 상한 (패스마다).
 * Cloudflare Pages 무료 플랜은 요청당 서브리퀘스트가 50개다 — 주문 하나에 포트원 조회 1 + DB 기록 1~3,
 * 복구되는 주문은 확정·시트 오픈·알림으로 그보다 훨씬 많이 쓴다.
 */
const RECONCILE_PER_STEP = 5;

export type SweepStepResult = {
  pendingHandled: number;
  ordersHandled: number;
  autoCanceledCount: number;
  recoveredCount: number;
  closedOrders: number;
  /** 결제 대조: 만료 전 미결제 주문 중 복구한 건수 */
  earlyRecoveredCount: number;
  /** 결제 대조: 취소된 주문에서 결제를 찾아 환불 대상으로 올린 건수 */
  paidAfterCancelCount: number;
  /** 결제 대조 중 포트원 조회에 실패해 건너뛴 건수 (다음 실행이 다시 본다) */
  lookupErrorCount: number;
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

/** 포트원엔 결제 완료인데 우리 쪽 반영이 빠진 주문 → 확정 (확정 함수가 포트원을 다시 조회해 검증한다) */
async function recoverPending(
  supabase: SupabaseClient,
  order: PendingOrder,
  now: Date,
  alerts: string[],
): Promise<PendingOutcome> {
  const result = await confirmPaidTesterOrder({ orderId: order.order_code });
  if (!result.ok) {
    await holdOrder(supabase, order.id, now, `포트원엔 결제 완료이나 반영 실패 (${result.message})`);
    alerts.push(`결제 복구 실패: ${order.order_code} — 포트원엔 결제 완료입니다. 수동 확인 필요.`);
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
        admin_note: `${AUTO_CANCEL_NOTE_PREFIX} — 24시간 미결제`,
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
  // 카드는 승인됐는데 우리 쪽 반영이 누락된 주문일 수 있다 → 포트원에 먼저 확인 (결제 ID = 주문 코드)
  const lookup = await lookupPortOnePayment(order.order_code);
  const decision = decidePendingOrder(lookup, expectedPortOnePayment(order.amount_krw));
  if (decision.action === "hold") {
    await holdOrder(supabase, order.id, now, decision.reason);
    alerts.push(`결제 대조 필요: ${order.order_code} — ${decision.reason}. 자동 취소하지 않았습니다.`);
    return "held";
  }
  if (decision.action === "recover") {
    return recoverPending(supabase, order, now, alerts);
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
        result.reverted
          ? `시트 마감 실패: "${appName}" (${order.order_code}) — 마감을 끝내지 못해 되돌렸습니다. 다음 스윕에서 재시도.`
          : `환불 기록 실패: "${appName}" (${order.order_code}) — 마감됐지만 미충원 시트 환불이 빠졌습니다. 수동 조정 필요.`,
      );
      // 되돌린 경우: 성공하면 지워지는 "확인 필요" 메모로 매일 리포트에 올린다.
      // 되돌리지 못한 경우: closeOrderSeats 가 남긴 "환불 실패" 메모를 그대로 둔다
      const keepExisting = order.admin_note?.startsWith(REFUND_FAILED_NOTE_PREFIX) ?? false;
      return {
        closed: false,
        note:
          result.reverted && !keepExisting
            ? attentionNote("시트 마감 실패 — 다음 스윕 재시도")
            : undefined,
      };
    }
    if (result.unfilled > 0 && result.refund) {
      alerts.push(
        result.refund.mode === "toss"
          ? `환불 필요: "${appName}" (${order.order_code}) 미충원 ${result.unfilled}시트 — PG 관리자(포트원 콘솔)에서 ${won(result.refund.amount)}원 부분취소 후 [환불 완료] 처리.`
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
): Promise<{ handled: number; closed: number; more: boolean; allStamped: boolean }> {
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
  // 기록에 실패한 주문은 다음 호출에 또 잡힌다 — 하나도 기록하지 못했으면 잡을 실패시켜 사람이 보게 한다
  if (orders.length > 0 && stamped === 0) throw new Error("스윕 시각(swept_at) 기록 실패");
  return {
    handled: orders.length,
    closed,
    more: stamped > 0 && (result.count ?? 0) > orders.length,
    allStamped: stamped === orders.length,
  };
}

/**
 * 결제 대조 a — 만료 전(15분~24시간) 미결제 주문. 결제는 끝났는데 구매자가 성공 화면으로 돌아오지 않은 주문을 복구만 한다.
 * 결제 완료 + 검증 통과가 아니면 상태·메모를 건드리지 않고 swept_at 만 찍는다 — 기존 스윕과 같은 방식으로
 * 20시간 안에는 다시 조회하지 않는다 (조회 실패도 찍는다: 다음 실행이 다시 본다).
 * 찍힌 주문은 24시간 미결제 스윕도 그 20시간 동안 건너뛴다 (취소가 그만큼 늦어질 수 있다 — 매일 1회 실행에서는 차이 없음).
 * 한 건 복구하면 멈춘다 — 복구는 시트 오픈 알림까지 보내 서브리퀘스트가 크다. 다음 호출이 이어서 본다.
 */
async function recoverEarlyPaid(
  supabase: SupabaseClient,
  now: Date,
  alerts: string[],
): Promise<{ recovered: number; lookupErrors: number; more: boolean }> {
  const orders = rowsOrThrow<PendingOrder>(
    await supabase
      .from("paid_tester_orders")
      .select("id, order_code, buyer_user_id, amount_krw, admin_note")
      .eq("status", "pending")
      .lt("created_at", new Date(now.getTime() - EARLY_RECOVERY_MIN_AGE_MS).toISOString())
      .gte("created_at", new Date(now.getTime() - PENDING_EXPIRY_MS).toISOString())
      .or(resweepFilter(now, RESWEEP_AFTER_MS))
      .order("created_at", { ascending: true })
      .limit(RECONCILE_PER_STEP),
    "만료 전 미결제 주문",
  );
  let lookupErrors = 0;
  let recorded = 0;
  for (const order of orders) {
    const decision = decideEarlyRecovery(await lookupPortOnePayment(order.order_code), expectedPortOnePayment(order.amount_krw));
    if (decision === "lookup_error") lookupErrors++;
    if (decision === "recover") {
      const result = await confirmPaidTesterOrder({ orderId: order.order_code });
      if (result.ok) {
        alerts.push(`결제 복구: ${order.order_code} — 결제 완료 후 반영이 빠져 있던 주문을 확정했습니다.`);
        // 복구된 주문은 pending 에서 빠진다 → 다시 불러도 반드시 끝난다
        return { recovered: 1, lookupErrors, more: true };
      }
    }
    const { error } = await supabase
      .from("paid_tester_orders")
      .update({ swept_at: now.toISOString() })
      .eq("id", order.id)
      .eq("status", "pending");
    if (error) console.error("[paid-order-sweep] early-recovery stamp failed", order.id, error);
    else recorded++;
  }
  return {
    recovered: 0,
    lookupErrors,
    more: reconcileHasMore({ picked: orders.length, cap: RECONCILE_PER_STEP, recorded }),
  };
}

type CanceledOrder = { id: number; order_code: string; admin_note: string | null };

/**
 * 결제 대조 b — 결제 기록 없이 취소된 최근 주문 중 최신 5건. 취소 뒤에 결제창에서 결제가 끝났는데 구매자가 돌아오지 않은 경우를 찾는다.
 * 결제 완료면 confirmPaidTesterOrder 의 "취소된 주문에 결제" 경로로 환불 대상 메모를 남긴다 (멱등). 그 외에는 아무것도 하지 않는다.
 * "조회했음"을 남길 열이 없어 밀린 주문을 이어서 보지 못한다 — 실행마다 최신 5건만 본다 (more 에 반영하지 않으므로 반복 호출이 끝난다).
 * 취소 시각 열이 없어 주문 생성 시각으로 기간을 잡는다. 이미 메모가 붙은 주문은 조회하지 않는다.
 */
async function flagPaidOnCanceled(
  supabase: SupabaseClient,
  now: Date,
  alerts: string[],
): Promise<{ flagged: number; lookupErrors: number }> {
  const rows = rowsOrThrow<CanceledOrder>(
    await supabase
      .from("paid_tester_orders")
      .select("id, order_code, admin_note")
      .eq("status", "canceled")
      .is("paid_at", null)
      .gte("created_at", new Date(now.getTime() - CANCELED_CHECK_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(RECONCILE_PER_STEP * 2),
    "취소된 주문",
  );
  const orders = rows.filter((o) => !hasPaidAfterCancelNote(o.admin_note)).slice(0, RECONCILE_PER_STEP);
  let flagged = 0;
  let lookupErrors = 0;
  for (const order of orders) {
    const decision = decideCanceledOrderCheck(await lookupPortOnePayment(order.order_code));
    if (decision === "lookup_error") lookupErrors++;
    if (decision !== "flag") continue;
    // 확정 함수가 다시 조회해 메모를 남기고 "closed" 로 답한다. 기록에 실패하면(retry) 다음 실행이 다시 본다
    const result = await confirmPaidTesterOrder({ orderId: order.order_code });
    if (result.ok || result.reason !== "closed") continue;
    flagged++;
    alerts.push(
      `환불 필요: 취소된 주문 ${order.order_code} 에 카드 결제가 있습니다 — PG 관리자(포트원 콘솔)에서 전액 환불.`,
    );
  }
  return { flagged, lookupErrors };
}

/**
 * 스윕 한 단계. 미결제 건이 있으면 그것만, 없으면 열린 주문 몇 건을 처리한다.
 * 둘 다 처리한 것이 없는 단계에서만 결제 대조(a → b)를 돈다 — 한 요청의 서브리퀘스트를 기존 패스와 나눠 쓰지 않는다.
 * more 는 "이번 단계에서 고른 주문이 전부 다음 호출의 대상에서 빠졌을 때"만 true 다 (상태 변경 또는 swept_at) → 반드시 끝난다.
 */
export async function runSweepStep(supabase: SupabaseClient, now: Date): Promise<SweepStepResult> {
  const alerts: string[] = [];
  const step: SweepStepResult = {
    pendingHandled: 0,
    ordersHandled: 0,
    autoCanceledCount: 0,
    recoveredCount: 0,
    closedOrders: 0,
    earlyRecoveredCount: 0,
    paidAfterCancelCount: 0,
    lookupErrorCount: 0,
    alerts,
    more: false,
  };
  const pending = await sweepPending(supabase, now, alerts);
  if (pending.handled > 0) {
    // 처리한 건은 상태가 바뀌거나 swept_at 이 찍혀 다음 호출에서 빠진다 → 반드시 끝난다
    return {
      ...step,
      pendingHandled: pending.handled,
      autoCanceledCount: pending.canceled,
      recoveredCount: pending.recovered,
      more: true,
    };
  }
  const open = await sweepOpenOrders(supabase, now, alerts);
  if (open.handled > 0) {
    // 처리한 주문이 전부 기록됐으면 한 번 더 부르게 해, 다음 단계가 결제 대조만 돌게 한다
    return {
      ...step,
      ordersHandled: open.handled,
      closedOrders: open.closed,
      more: open.more || open.allStamped,
    };
  }

  const early = await recoverEarlyPaid(supabase, now, alerts);
  const afterEarly = {
    ...step,
    earlyRecoveredCount: early.recovered,
    lookupErrorCount: early.lookupErrors,
  };
  // 밀린 미결제 주문이 남았으면 그것부터 — 취소 주문 대조는 마지막 단계에서 한 번만 돈다
  if (early.more) return { ...afterEarly, more: true };

  const canceled = await flagPaidOnCanceled(supabase, now, alerts);
  return {
    ...afterEarly,
    paidAfterCancelCount: canceled.flagged,
    lookupErrorCount: early.lookupErrors + canceled.lookupErrors,
  };
}
