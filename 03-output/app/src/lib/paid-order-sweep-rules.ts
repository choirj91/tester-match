/**
 * 유료 주문 스윕의 판정 규칙 — 순수 함수 (DB·네트워크 없음, 단위 테스트 대상).
 * IO 는 lib/paid-order-sweep.ts 가 맡는다.
 */

import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import { PORTONE_PAID_STATUS, type PortOneLookup, type PortOnePayment } from "@/lib/portone";

/** admin_note 접두어 — 이 접두어가 붙은 주문은 매일 리포트 경보에 오른다 */
export const ATTENTION_NOTE_PREFIX = "확인 필요";
export const REFUND_FAILED_NOTE_PREFIX = "환불 실패";
const NOTE_MAX_LENGTH = 500;
/**
 * 포트원 결제가 이 상태면 주문을 취소해도 돈이 남지 않는다.
 * 포트원에는 서버 승인(confirm) 관문이 없다 — PG 승인이 결제창 안에서 끝나므로 주문을 취소해도 과금 경로가 닫히지 않는다.
 * 그래도 READY 를 취소 대상으로 두는 이유: 만료 기준(24시간)을 넘긴 주문의 READY 는 결제창만 열고 떠난 경우다
 * (PG 결제 세션은 그보다 훨씬 먼저 만료된다). 취소한 뒤에도 결제가 들어오면 confirmPaidTesterOrder 가
 * "취소된 주문에 결제 있음" 메모를 남겨 환불 대상으로 올린다 (lib/paid-orders.ts).
 */
const PORTONE_DEAD_STATUSES: readonly string[] = ["FAILED", "CANCELLED", "READY"];

/** 스윕이 미결제 주문을 자동 취소할 때 남기는 메모의 접두어 (리포트가 이 접두어로 건수를 센다) */
export const AUTO_CANCEL_NOTE_PREFIX = "자동 취소";

export const won = (n: number): string => n.toLocaleString("ko-KR");

export function attentionNote(text: string): string {
  return `${ATTENTION_NOTE_PREFIX}: ${text}`.slice(0, NOTE_MAX_LENGTH);
}

export function hasAttentionNote(note: string | null | undefined): boolean {
  return note?.startsWith(ATTENTION_NOTE_PREFIX) ?? false;
}

/**
 * 결제 확정(lib/paid-orders.ts)이 남기는 "확인 필요" 메모 — 일일 리포트가 처리될 때까지 매일 올린다.
 * 표식 문구로 이미 남긴 메모인지 판별해 새로고침마다 다시 쓰지 않는다. 이전 메모(취소 사유 등)는 뒤에 보존한다.
 */
const PAID_AFTER_CANCEL_NOTE_MARK = "취소된 주문에 카드 결제가 있습니다";
const PAYMENT_MISMATCH_NOTE_MARK = "결제가 주문과 맞지 않습니다";

function markedNote(mark: string, detail: string, previousNote: string | null): string {
  const previous = previousNote ? ` (이전 메모: ${previousNote})` : "";
  return attentionNote(`${mark} — ${detail}${previous}`);
}

const hasMarkedNote = (note: string | null | undefined, mark: string): boolean =>
  hasAttentionNote(note) && (note?.includes(mark) ?? false);

/** 취소된(결제 기록 없는) 주문에 카드 결제가 들어온 경우 — 전액 환불 대상 */
export function paidAfterCancelNote(paidKrw: number, previousNote: string | null): string {
  return markedNote(
    PAID_AFTER_CANCEL_NOTE_MARK,
    `PG 관리자(포트원 콘솔)에서 ${won(paidKrw)}원 전액 환불 필요`,
    previousNote,
  );
}

export function hasPaidAfterCancelNote(note: string | null | undefined): boolean {
  return hasMarkedNote(note, PAID_AFTER_CANCEL_NOTE_MARK);
}

/** 미결제 주문에 결제는 됐는데 검증(금액·통화·채널)이 틀린 경우 — 확정하지 않고 운영자가 대조한다 */
export function paymentMismatchNote(reason: string, previousNote: string | null): string {
  return markedNote(
    PAYMENT_MISMATCH_NOTE_MARK,
    `${reason}. 주문은 확정하지 않았습니다 (PG 관리자(포트원 콘솔)에서 대조·환불)`,
    previousNote,
  );
}

export function hasPaymentMismatchNote(note: string | null | undefined): boolean {
  return hasMarkedNote(note, PAYMENT_MISMATCH_NOTE_MARK);
}

const ORDER_CURRENCY = "KRW";

const LIVE_CHANNEL_TYPE = "LIVE";

/**
 * 주문이 기대하는 결제 — 금액은 DB 의 주문 금액, 채널 키는 우리 결제 채널 (미설정이면 검증 불가).
 * requireLiveChannel: 주문을 일반에 공개한 뒤에는 실결제(LIVE) 채널 결제만 인정한다.
 * 공개 전에는 우리 채널의 테스트 결제도 통과시킨다 (심사 계정·PG 심사의 시험 결제).
 */
export type PaymentExpectation = {
  amountKrw: number;
  channelKey: string | undefined;
  requireLiveChannel: boolean;
};

export type PaidCheck =
  | { kind: "paid" }
  | { kind: "not_paid" }
  | { kind: "mismatch"; reason: string }
  | { kind: "unverifiable"; reason: string };

const mismatch = (reason: string): PaidCheck => ({ kind: "mismatch", reason });

/**
 * 이 결제가 "이 주문의 결제 완료"인가 — 주문 확정(lib/paid-orders.ts)과 스윕이 같은 기준을 쓴다.
 * 상태 PAID 만으로는 부족하다: 채널 키가 공개된 테스트 채널로 같은 결제 ID 를 결제할 수 있으므로
 * 통화(KRW)·결제 채널(우리 채널 키)·금액(총액 = 주문 금액, 실결제액 = 총액)을 모두 대조한다.
 */
export function checkPaidPayment(payment: PortOnePayment, expected: PaymentExpectation): PaidCheck {
  if (payment.status !== PORTONE_PAID_STATUS) return { kind: "not_paid" };
  if (!expected.channelKey) {
    return { kind: "unverifiable", reason: "결제 채널 키 미설정 — 결제 채널을 검증할 수 없음" };
  }
  if (payment.currency !== ORDER_CURRENCY) {
    return mismatch(`통화 ${payment.currency ?? "없음"} (${ORDER_CURRENCY} 아님)`);
  }
  if (payment.channelKey !== expected.channelKey) {
    return mismatch(`다른 결제 채널(${payment.channelType ?? "알 수 없음"})에서 결제됨`);
  }
  if (expected.requireLiveChannel && payment.channelType !== LIVE_CHANNEL_TYPE) {
    return mismatch("테스트 채널 결제");
  }
  if (payment.totalAmount !== expected.amountKrw) {
    return mismatch(`결제 ${won(payment.totalAmount)}원 / 주문 ${won(expected.amountKrw)}원`);
  }
  if (payment.paidAmount !== undefined && payment.paidAmount !== payment.totalAmount) {
    return mismatch(`실결제 ${won(payment.paidAmount)}원 / 결제 총액 ${won(payment.totalAmount)}원`);
  }
  return { kind: "paid" };
}

/**
 * 결제창을 다시 열어도 되는 상태 — 결제창만 열렸거나(READY) 결제가 실패했다(FAILED).
 * 그 외 미완료 상태(승인·입금 대기, 부분 취소, 취소, 모르는 상태)는 돈이 걸려 있거나 알 수 없으므로 다시 결제하게 두지 않는다.
 */
const PORTONE_RETRYABLE_STATUSES: readonly string[] = ["READY", "FAILED"];

export function isRetryablePaymentStatus(status: string): boolean {
  return PORTONE_RETRYABLE_STATUSES.includes(status);
}

export type PendingDecision =
  | { action: "recover" }
  | { action: "cancel" }
  | { action: "hold"; reason: string };

/**
 * 24시간 넘게 미결제인 주문을 어떻게 할지 — 포트원 조회 결과로 판정 (관리자의 미결제 주문 취소도 같은 판정을 쓴다).
 * 원칙: 돈이 들어왔거나 들어올 수 있으면 취소하지 않는다. 확인할 수 없으면 보류한다.
 */
export function decidePendingOrder(lookup: PortOneLookup, expected: PaymentExpectation): PendingDecision {
  if (lookup.kind === "error") {
    return { action: "hold", reason: "포트원 조회 실패 — 결제 여부를 확인하지 못해 취소를 보류" };
  }
  if (lookup.kind === "not_found") return { action: "cancel" };

  const { status, totalAmount } = lookup.payment;
  const check = checkPaidPayment(lookup.payment, expected);
  // 확정은 confirmPaidTesterOrder 가 포트원을 다시 조회해 판단한다 — 여기서 넘길 값은 없다
  if (check.kind === "paid") return { action: "recover" };
  if (check.kind !== "not_paid") {
    return { action: "hold", reason: `포트원엔 결제 완료이나 주문과 대조 필요 — ${check.reason}` };
  }
  if (PORTONE_DEAD_STATUSES.includes(status)) return { action: "cancel" };
  // 승인 대기·입금 대기·부분 취소·모르는 상태 — 취소하면 돈과 주문이 어긋날 수 있다
  return {
    action: "hold",
    reason: `포트원 결제 상태 ${status} / ${won(totalAmount)}원 — 주문 ${won(expected.amountKrw)}원과 대조 필요`,
  };
}

export type ReconcileDecision = "recover" | "flag" | "skip" | "lookup_error";

/**
 * 만료(24시간) 전 미결제 주문 — 복구만 한다. 결제 완료 + 검증 통과일 때만 확정하고,
 * 그 외에는 건드리지 않는다 (취소·메모 없음 — 구매자가 아직 결제 중일 수 있다).
 */
export function decideEarlyRecovery(
  lookup: PortOneLookup,
  expected: PaymentExpectation,
): Extract<ReconcileDecision, "recover" | "skip" | "lookup_error"> {
  if (lookup.kind === "error") return "lookup_error";
  if (lookup.kind === "not_found") return "skip";
  return checkPaidPayment(lookup.payment, expected).kind === "paid" ? "recover" : "skip";
}

/**
 * 결제 기록 없이 취소된 주문 — 취소 뒤에 결제창에서 결제가 끝났는데 구매자가 성공 화면으로 돌아오지 않은 경우를 찾는다.
 * 결제 완료면 금액·채널과 무관하게 환불 대상으로 올린다 (돈이 남아 있다). 그 외에는 아무것도 하지 않는다.
 */
export function decideCanceledOrderCheck(
  lookup: PortOneLookup,
): Extract<ReconcileDecision, "flag" | "skip" | "lookup_error"> {
  if (lookup.kind === "error") return "lookup_error";
  if (lookup.kind === "not_found") return "skip";
  return lookup.payment.status === PORTONE_PAID_STATUS ? "flag" : "skip";
}

/**
 * 결제 대조 패스가 "더 남았다(more)"고 답할지 — 상한까지 꽉 채워 골랐고, 고른 주문을 전부 기록(swept_at)했을 때만.
 * 기록하지 못한 주문이 있으면 다음 호출이 같은 주문을 또 고르므로 더 부르지 않는다 (반복 호출이 끝나지 않는다).
 */
export function reconcileHasMore(args: { picked: number; cap: number; recorded: number }): boolean {
  return args.picked >= args.cap && args.recorded === args.picked;
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
