/**
 * 유료 주문 스윕의 판정 규칙 — 순수 함수 (DB·네트워크 없음, 단위 테스트 대상).
 * IO 는 lib/paid-order-sweep.ts 가 맡는다.
 */

import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import type { TossLookup } from "@/lib/toss";

/** admin_note 접두어 — 이 접두어가 붙은 주문은 매일 리포트 경보에 오른다 */
export const ATTENTION_NOTE_PREFIX = "확인 필요";
export const REFUND_FAILED_NOTE_PREFIX = "환불 실패";
const NOTE_MAX_LENGTH = 500;
/**
 * 토스 결제가 이 상태면 주문을 취소해도 돈이 남지 않는다.
 * READY·IN_PROGRESS 는 결제창만 열고 떠난 경우 — 승인 API(confirm)를 호출해야 과금되는데,
 * 우리 confirm 은 pending 이 아닌 주문을 거부하므로 주문을 취소하면 과금 경로가 닫힌다.
 */
const TOSS_DEAD_STATUSES: readonly string[] = [
  "CANCELED",
  "ABORTED",
  "EXPIRED",
  "READY",
  "IN_PROGRESS",
];
const TOSS_PAID_STATUS = "DONE";

/** 스윕이 미결제 주문을 자동 취소할 때 남기는 메모의 접두어 (리포트가 이 접두어로 건수를 센다) */
export const AUTO_CANCEL_NOTE_PREFIX = "자동 취소";

export const won = (n: number): string => n.toLocaleString("ko-KR");

export function attentionNote(text: string): string {
  return `${ATTENTION_NOTE_PREFIX}: ${text}`.slice(0, NOTE_MAX_LENGTH);
}

export function hasAttentionNote(note: string | null | undefined): boolean {
  return note?.startsWith(ATTENTION_NOTE_PREFIX) ?? false;
}

export type PendingDecision =
  | { action: "recover"; paymentKey: string }
  | { action: "cancel" }
  | { action: "hold"; reason: string };

/**
 * 24시간 넘게 미결제인 주문을 어떻게 할지 — 토스 조회 결과로 판정.
 * 원칙: 돈이 들어왔거나 들어올 수 있으면 취소하지 않는다. 확인할 수 없으면 보류한다.
 */
export function decidePendingOrder(lookup: TossLookup, amountKrw: number): PendingDecision {
  if (lookup.kind === "error") {
    return { action: "hold", reason: "토스 조회 실패 — 결제 여부를 확인하지 못해 취소를 보류" };
  }
  if (lookup.kind === "not_found") return { action: "cancel" };

  const { status, totalAmount, paymentKey } = lookup.payment;
  if (status === TOSS_PAID_STATUS && totalAmount === amountKrw) {
    return { action: "recover", paymentKey };
  }
  if (TOSS_DEAD_STATUSES.includes(status)) return { action: "cancel" };
  // 입금 대기·금액 불일치·부분 취소·모르는 상태 — 취소하면 돈과 주문이 어긋날 수 있다
  return {
    action: "hold",
    reason: `토스 결제 상태 ${status} / ${won(totalAmount)}원 — 주문 ${won(amountKrw)}원과 대조 필요`,
  };
}

export type ClosedOrderForReconcile = {
  status: string;
  fulfillment: "community" | "operator";
  tester_count: number;
  amount_krw: number;
};

/**
 * 끝난 주문에 기록돼 있어야 할 환불액.
 * 커뮤니티 주문: 과금 대상이 아닌 시트(= 전체 − 완주 + 몰수) × 단가. 몰수된 시트는 완주 상태지만 환불된다.
 * 운영자 처리 주문: 완료면 0, 그 외(취소·환불)는 전액.
 */
export function expectedRefundKrw(
  order: ClosedOrderForReconcile,
  seats: { completed: number; forfeited: number },
): number {
  if (order.fulfillment === "operator") {
    return order.status === "completed" ? 0 : order.amount_krw;
  }
  const charged = Math.max(0, seats.completed - seats.forfeited);
  return Math.max(0, order.tester_count - charged) * PAID_TESTER_PRICE_KRW;
}

/** PostgREST or() 필터: 아직 스윕하지 않았거나 마지막 스윕이 afterMs 이전인 주문 */
export function resweepFilter(now: Date, afterMs: number): string {
  return `swept_at.is.null,swept_at.lt.${new Date(now.getTime() - afterMs).toISOString()}`;
}
