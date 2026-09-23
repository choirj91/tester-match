import { describe, expect, test } from "vitest";
import {
  PAID_TESTER_PRICE_KRW,
  newPaidOrderCode,
  paidTesterAmountKrw,
  paidTesterOrderName,
} from "./paid-testers";

describe("paidTesterAmountKrw", () => {
  test("1명은 단가와 동일하다", () => {
    expect(paidTesterAmountKrw(1)).toBe(PAID_TESTER_PRICE_KRW);
  });

  test("10명은 10,000원이다", () => {
    expect(paidTesterAmountKrw(10)).toBe(10_000);
  });
});

describe("paidTesterOrderName", () => {
  test("앱 이름과 인원이 포함된다", () => {
    expect(paidTesterOrderName("가계부", 3)).toBe("가계부 테스터 3명 (14일)");
  });

  test("긴 앱 이름도 토스 제한(100자) 이내로 축약된다", () => {
    const longName = "앱".repeat(200);
    const orderName = paidTesterOrderName(longName, 10);
    expect(orderName.length).toBeLessThanOrEqual(100);
    expect(orderName).toContain("…");
    expect(orderName.endsWith("테스터 10명 (14일)")).toBe(true);
  });
});

describe("newPaidOrderCode", () => {
  test("토스 orderId 규칙(6~64자, [A-Za-z0-9_-])을 만족한다", () => {
    const code = newPaidOrderCode();
    expect(code).toMatch(/^pt_[0-9a-f]{32}$/);
    expect(code.length).toBeGreaterThanOrEqual(6);
    expect(code.length).toBeLessThanOrEqual(64);
  });

  test("호출마다 고유하다", () => {
    expect(newPaidOrderCode()).not.toBe(newPaidOrderCode());
  });
});
