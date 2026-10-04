import { describe, expect, test } from "vitest";
import {
  ATTENTION_NOTE_PREFIX,
  attentionNote,
  checkPaidPayment,
  decideCanceledOrderCheck,
  decideEarlyRecovery,
  decidePendingOrder,
  expectedRefundKrw,
  hasAttentionNote,
  hasPaidAfterCancelNote,
  hasPaymentMismatchNote,
  isRetryablePaymentStatus,
  paidAfterCancelNote,
  paymentMismatchNote,
  reconcileHasMore,
  resweepFilter,
} from "./paid-order-sweep-rules";
import type { PortOnePayment } from "./portone";

const CHANNEL_KEY = "channel-key-live";
const expected = { amountKrw: 3000, channelKey: CHANNEL_KEY, requireLiveChannel: false };

const paidPayment = (overrides: Partial<PortOnePayment> = {}): PortOnePayment => ({
  id: "pt_x",
  status: "PAID",
  totalAmount: 3000,
  paidAmount: 3000,
  currency: "KRW",
  channelKey: CHANNEL_KEY,
  channelType: "LIVE",
  transactionId: "tx_1",
  ...overrides,
});
const found = (overrides: Partial<PortOnePayment> = {}) => ({
  kind: "found" as const,
  payment: paidPayment(overrides),
});

describe("checkPaidPayment", () => {
  test("결제 완료 + 금액·통화·채널이 모두 맞으면 이 주문의 결제다", () => {
    expect(checkPaidPayment(paidPayment(), expected)).toEqual({ kind: "paid" });
  });

  test("실결제액(amount.paid)이 응답에 없어도 나머지가 맞으면 통과한다", () => {
    expect(checkPaidPayment(paidPayment({ paidAmount: undefined }), expected)).toEqual({ kind: "paid" });
  });

  test("결제 완료가 아니면 not_paid", () => {
    expect(checkPaidPayment(paidPayment({ status: "READY" }), expected)).toEqual({ kind: "not_paid" });
  });

  test.each<[string, Partial<PortOnePayment>, string]>([
    ["금액이 다름", { totalAmount: 1000, paidAmount: 1000 }, "1,000원"],
    ["통화가 원화가 아님", { currency: "USD" }, "USD"],
    ["다른 채널(테스트 채널)에서 결제됨", { channelKey: "channel-key-test", channelType: "TEST" }, "TEST"],
    ["실결제액이 총액과 다름", { paidAmount: 2000 }, "2,000원"],
  ])("결제 완료여도 %s 이면 불일치 — 어느 검증이 틀렸는지 사유에 적는다", (_label, overrides, text) => {
    const check = checkPaidPayment(paidPayment(overrides), expected);
    expect(check.kind).toBe("mismatch");
    expect(check.kind === "mismatch" && check.reason).toContain(text);
  });

  test("우리 채널 키가 설정돼 있지 않으면 검증할 수 없다 — 확정하지 않는다", () => {
    const check = checkPaidPayment(paidPayment(), { ...expected, channelKey: undefined });
    expect(check.kind).toBe("unverifiable");
  });
});

describe("checkPaidPayment — 실결제(LIVE) 채널 요구", () => {
  const testChannelPayment = paidPayment({ channelType: "TEST" });
  const live = { ...expected, requireLiveChannel: true };

  test("공개 주문 전(요구 안 함)에는 우리 채널의 테스트 결제도 통과한다 — 심사·시험 결제", () => {
    expect(checkPaidPayment(testChannelPayment, expected)).toEqual({ kind: "paid" });
  });

  test("공개 주문 후(요구함)에는 테스트 채널 결제를 불일치로 본다", () => {
    expect(checkPaidPayment(testChannelPayment, live)).toEqual({
      kind: "mismatch",
      reason: "테스트 채널 결제",
    });
  });

  test("요구해도 실결제 채널 결제는 통과한다", () => {
    expect(checkPaidPayment(paidPayment(), live)).toEqual({ kind: "paid" });
  });

  test("스윕도 같은 기준 — 테스트 채널 결제는 복구하지 않고 보류한다", () => {
    const decision = decidePendingOrder(found({ channelType: "TEST" }), live);
    expect(decision.action).toBe("hold");
    expect(decision.action === "hold" && decision.reason).toContain("테스트 채널 결제");
    expect(decideEarlyRecovery(found({ channelType: "TEST" }), live)).toBe("skip");
  });
});

describe("isRetryablePaymentStatus — 결제창을 다시 열어도 되는 상태", () => {
  test.each(["READY", "FAILED"])("%s 는 다시 결제할 수 있다", (status) => {
    expect(isRetryablePaymentStatus(status)).toBe(true);
  });

  test.each(["PENDING", "PAY_PENDING", "VIRTUAL_ACCOUNT_ISSUED", "PARTIAL_CANCELLED", "CANCELLED", "PAID", "SOMETHING_NEW"])(
    "%s 는 다시 결제하게 두지 않는다",
    (status) => {
      expect(isRetryablePaymentStatus(status)).toBe(false);
    },
  );
});

describe("decidePendingOrder", () => {
  test("포트원에 결제가 없으면 취소한다", () => {
    expect(decidePendingOrder({ kind: "not_found" }, expected)).toEqual({ action: "cancel" });
  });

  test("조회에 실패하면 취소하지 않고 보류한다", () => {
    expect(decidePendingOrder({ kind: "error" }, expected).action).toBe("hold");
  });

  test("결제 완료 + 검증 통과면 주문을 복구한다", () => {
    expect(decidePendingOrder(found(), expected)).toEqual({ action: "recover" });
  });

  test.each<[string, Partial<PortOnePayment>, string]>([
    ["금액이 다름", { totalAmount: 2000, paidAmount: 2000 }, "2,000"],
    ["다른 채널", { channelKey: "channel-key-test", channelType: "TEST" }, "TEST"],
    ["다른 통화", { currency: "USD" }, "USD"],
  ])("결제 완료인데 %s 이면 사유와 함께 보류한다", (_label, overrides, text) => {
    const decision = decidePendingOrder(found(overrides), expected);
    expect(decision.action).toBe("hold");
    expect(decision.action === "hold" && decision.reason).toContain(text);
  });

  test("채널 키 미설정이면 결제 완료여도 복구하지 않고 보류한다", () => {
    expect(decidePendingOrder(found(), { ...expected, channelKey: undefined }).action).toBe("hold");
  });

  test.each(["FAILED", "CANCELLED", "READY"])("돈이 남지 않는 상태(%s)면 취소한다", (status) => {
    expect(decidePendingOrder(found({ status }), expected)).toEqual({ action: "cancel" });
  });

  test.each(["PENDING", "PAY_PENDING", "VIRTUAL_ACCOUNT_ISSUED", "PARTIAL_CANCELLED", "SOMETHING_NEW"])(
    "돈이 들어왔거나 들어올 수 있는 상태(%s)면 보류한다",
    (status) => {
      const decision = decidePendingOrder(found({ status }), expected);
      expect(decision.action).toBe("hold");
      expect(decision.action === "hold" && decision.reason).toContain(status);
    },
  );

  test("토스 시절 상태 이름(DONE·CANCELED)은 모르는 상태로 보고 보류한다", () => {
    expect(decidePendingOrder(found({ status: "DONE" }), expected).action).toBe("hold");
    expect(decidePendingOrder(found({ status: "CANCELED" }), expected).action).toBe("hold");
  });
});

describe("decideEarlyRecovery — 만료 전 미결제 주문은 복구만 한다", () => {
  test("결제 완료 + 검증 통과면 복구", () => {
    expect(decideEarlyRecovery(found(), expected)).toBe("recover");
  });

  test("조회 실패는 건너뛰되 따로 센다", () => {
    expect(decideEarlyRecovery({ kind: "error" }, expected)).toBe("lookup_error");
  });

  test.each([
    ["결제 없음", { kind: "not_found" as const }],
    ["결제창만 연 상태", found({ status: "READY" })],
    ["검증 실패(다른 채널)", found({ channelKey: "channel-key-test" })],
    ["금액 불일치", found({ totalAmount: 1000 })],
  ])("%s 이면 건드리지 않는다 (취소·메모 없음)", (_label, lookup) => {
    expect(decideEarlyRecovery(lookup, expected)).toBe("skip");
  });
});

describe("decideCanceledOrderCheck — 취소된 주문에 들어온 결제 찾기", () => {
  test("결제 완료면 환불 대상으로 올린다 (금액·채널과 무관)", () => {
    expect(decideCanceledOrderCheck(found({ totalAmount: 1000 }))).toBe("flag");
  });

  test("조회 실패는 건너뛰되 따로 센다", () => {
    expect(decideCanceledOrderCheck({ kind: "error" })).toBe("lookup_error");
  });

  test.each([
    ["결제 없음", { kind: "not_found" as const }],
    ["결제창만 연 상태", found({ status: "READY" })],
    ["PG 에서 이미 취소됨", found({ status: "CANCELLED" })],
  ])("%s 이면 아무것도 하지 않는다", (_label, lookup) => {
    expect(decideCanceledOrderCheck(lookup)).toBe("skip");
  });
});

describe("expectedRefundKrw", () => {
  const community = { status: "completed", fulfillment: "community" as const, tester_count: 5, amount_krw: 5000 };
  const none = { completed: 0, forfeited: 0 };

  test("커뮤니티 주문은 완주하지 않은 시트만큼 환불 대상이다", () => {
    expect(expectedRefundKrw(community, { completed: 3, forfeited: 0 })).toBe(2000);
  });

  test("전 시트 완주면 환불 대상이 없다", () => {
    expect(expectedRefundKrw(community, { completed: 5, forfeited: 0 })).toBe(0);
  });

  test("몰수된 시트는 완주 상태여도 환불 대상이다", () => {
    expect(expectedRefundKrw(community, { completed: 5, forfeited: 2 })).toBe(2000);
  });

  test("완주 수가 시트 수를 넘어도 음수가 되지 않는다", () => {
    expect(expectedRefundKrw(community, { completed: 6, forfeited: 0 })).toBe(0);
  });

  test("완주 없이 취소된 주문은 전액 환불 대상이다", () => {
    expect(expectedRefundKrw({ ...community, status: "canceled" }, none)).toBe(5000);
  });

  test("운영자 처리 주문은 취소·환불이면 전액, 완료면 0", () => {
    const operator = { ...community, fulfillment: "operator" as const };
    expect(expectedRefundKrw({ ...operator, status: "canceled" }, none)).toBe(5000);
    expect(expectedRefundKrw({ ...operator, status: "refunded" }, none)).toBe(5000);
    expect(expectedRefundKrw({ ...operator, status: "completed" }, none)).toBe(0);
  });

  test("전액 환불된 커뮤니티 주문은 전액이 환불 대상이다", () => {
    expect(expectedRefundKrw({ ...community, status: "refunded" }, none)).toBe(5000);
  });
});

describe("attention notes", () => {
  test("접두어를 붙이고 길이를 제한한다", () => {
    const note = attentionNote("가".repeat(600));
    expect(note.startsWith(`${ATTENTION_NOTE_PREFIX}: `)).toBe(true);
    expect(note.length).toBe(500);
  });

  test("접두어가 있는 메모만 확인 필요로 본다", () => {
    expect(hasAttentionNote(attentionNote("포트원 조회 실패"))).toBe(true);
    expect(hasAttentionNote("자동 취소 — 24시간 미결제")).toBe(false);
    expect(hasAttentionNote(null)).toBe(false);
  });
});

describe("paidAfterCancelNote", () => {
  test("확인 필요 메모로 남겨 일일 리포트에 오르고, 환불할 금액을 적는다", () => {
    const note = paidAfterCancelNote(3000, null);
    expect(hasAttentionNote(note)).toBe(true);
    expect(note).toContain("3,000원");
    expect(note).toContain("환불");
  });

  test("이전 메모(자동 취소 사유)를 덧붙여 보존한다", () => {
    expect(paidAfterCancelNote(3000, "자동 취소 — 24시간 미결제")).toContain(
      "(이전 메모: 자동 취소 — 24시간 미결제)",
    );
  });

  test("이미 남긴 메모인지 알아본다 — 새로고침마다 다시 쓰지 않기 위한 판별", () => {
    expect(hasPaidAfterCancelNote(paidAfterCancelNote(3000, "자동 취소 — 24시간 미결제"))).toBe(true);
    expect(hasPaidAfterCancelNote("자동 취소 — 24시간 미결제")).toBe(false);
    expect(hasPaidAfterCancelNote(attentionNote("포트원 조회 실패"))).toBe(false);
    expect(hasPaidAfterCancelNote(null)).toBe(false);
  });
});

describe("paymentMismatchNote", () => {
  test("확인 필요 메모에 어긋난 사유를 적고 이전 메모를 보존한다", () => {
    const note = paymentMismatchNote("결제 1,000원 / 주문 3,000원", "기존 메모");
    expect(hasAttentionNote(note)).toBe(true);
    expect(note).toContain("결제 1,000원 / 주문 3,000원");
    expect(note).toContain("(이전 메모: 기존 메모)");
  });

  test("이미 남긴 메모인지 알아보고, 취소 후 결제 메모와 섞이지 않는다", () => {
    expect(hasPaymentMismatchNote(paymentMismatchNote("통화 USD", null))).toBe(true);
    expect(hasPaymentMismatchNote(paidAfterCancelNote(3000, null))).toBe(false);
    expect(hasPaidAfterCancelNote(paymentMismatchNote("통화 USD", null))).toBe(false);
    expect(hasPaymentMismatchNote(null)).toBe(false);
  });
});

describe("reconcileHasMore — 결제 대조를 한 번 더 부를지", () => {
  test("상한까지 골랐고 전부 기록했으면 더 남았을 수 있다", () => {
    expect(reconcileHasMore({ picked: 5, cap: 5, recorded: 5 })).toBe(true);
  });

  test("상한보다 적게 골랐으면 밀린 주문이 없다", () => {
    expect(reconcileHasMore({ picked: 4, cap: 5, recorded: 4 })).toBe(false);
    expect(reconcileHasMore({ picked: 0, cap: 5, recorded: 0 })).toBe(false);
  });

  test("기록하지 못한 주문이 있으면 더 부르지 않는다 — 같은 주문을 또 고르게 된다", () => {
    expect(reconcileHasMore({ picked: 5, cap: 5, recorded: 4 })).toBe(false);
  });
});

describe("resweepFilter", () => {
  test("미스윕 또는 기준 시각 이전 스윕 주문을 고른다", () => {
    const now = new Date("2026-10-04T00:00:00.000Z");
    expect(resweepFilter(now, 20 * 60 * 60 * 1000)).toBe(
      "swept_at.is.null,swept_at.lt.2026-10-03T04:00:00.000Z",
    );
  });
});
