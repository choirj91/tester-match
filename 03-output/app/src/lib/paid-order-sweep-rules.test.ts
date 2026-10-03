import { describe, expect, test } from "vitest";
import {
  ATTENTION_NOTE_PREFIX,
  attentionNote,
  decidePendingOrder,
  expectedRefundKrw,
  hasAttentionNote,
  resweepFilter,
} from "./paid-order-sweep-rules";

const payment = (status: string, totalAmount: number) => ({
  kind: "found" as const,
  payment: { paymentKey: "pk_1", orderId: "pt_x", totalAmount, status },
});

describe("decidePendingOrder", () => {
  test("토스에 결제가 없으면 취소한다", () => {
    expect(decidePendingOrder({ kind: "not_found" }, 3000)).toEqual({ action: "cancel" });
  });

  test("조회에 실패하면 취소하지 않고 보류한다", () => {
    const decision = decidePendingOrder({ kind: "error" }, 3000);
    expect(decision.action).toBe("hold");
  });

  test("승인 완료 + 금액 일치면 주문을 복구한다", () => {
    expect(decidePendingOrder(payment("DONE", 3000), 3000)).toEqual({
      action: "recover",
      paymentKey: "pk_1",
    });
  });

  test("승인 완료인데 금액이 다르면 보류한다", () => {
    const decision = decidePendingOrder(payment("DONE", 2000), 3000);
    expect(decision.action).toBe("hold");
    expect(decision.action === "hold" && decision.reason).toContain("2,000");
  });

  test.each(["CANCELED", "ABORTED", "EXPIRED", "READY", "IN_PROGRESS"])(
    "과금되지 않은 상태(%s)면 취소한다",
    (status) => {
      expect(decidePendingOrder(payment(status, 3000), 3000)).toEqual({ action: "cancel" });
    },
  );

  test.each(["WAITING_FOR_DEPOSIT", "PARTIAL_CANCELED", "SOMETHING_NEW"])(
    "돈이 들어왔거나 들어올 수 있는 상태(%s)면 보류한다",
    (status) => {
      expect(decidePendingOrder(payment(status, 3000), 3000).action).toBe("hold");
    },
  );
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

  test("운영자 처리 주문은 취소면 전액, 완료면 0", () => {
    const operator = { ...community, fulfillment: "operator" as const };
    expect(expectedRefundKrw({ ...operator, status: "canceled" }, none)).toBe(5000);
    expect(expectedRefundKrw({ ...operator, status: "completed" }, none)).toBe(0);
  });
});

describe("attention notes", () => {
  test("접두어를 붙이고 길이를 제한한다", () => {
    const note = attentionNote("가".repeat(600));
    expect(note.startsWith(`${ATTENTION_NOTE_PREFIX}: `)).toBe(true);
    expect(note.length).toBe(500);
  });

  test("접두어가 있는 메모만 확인 필요로 본다", () => {
    expect(hasAttentionNote(attentionNote("토스 조회 실패"))).toBe(true);
    expect(hasAttentionNote("자동 취소 — 24시간 미결제")).toBe(false);
    expect(hasAttentionNote(null)).toBe(false);
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
