import { describe, expect, test } from "vitest";
import {
  PAID_TESTERS_PUBLIC_ORDERING,
  PAID_TESTER_PRICE_KRW,
  canOrderPaidTesters,
  newPaidOrderCode,
  paidTesterAmountKrw,
  paidTesterOrderName,
} from "./paid-testers";

describe("canOrderPaidTesters", () => {
  test("비로그인은 주문할 수 없다", () => {
    expect(canOrderPaidTesters(null)).toBe(false);
  });

  test("관리자는 항상 주문할 수 있다", () => {
    expect(canOrderPaidTesters({ role: "admin" })).toBe(true);
  });

  test("일반 사용자는 공개 플래그를 따른다", () => {
    expect(canOrderPaidTesters({ role: "user" })).toBe(PAID_TESTERS_PUBLIC_ORDERING);
  });
});

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

describe("주문 허용목록", () => {
  test("허용목록 이메일은 관리자가 아니어도 주문할 수 있고 심사 주문으로 분류된다", async () => {
    const prev = process.env.PAID_TESTERS_ORDER_ALLOWLIST;
    process.env.PAID_TESTERS_ORDER_ALLOWLIST = "Review@Example.com, other@example.com";
    try {
      const mod = await import("./paid-testers");
      const reviewer = { role: "user", email: "review@example.com" };
      expect(mod.canOrderPaidTesters(reviewer)).toBe(true);
      expect(mod.isReviewOrderer(reviewer)).toBe(!mod.PAID_TESTERS_PUBLIC_ORDERING);
      expect(mod.isReviewOrderer({ role: "admin", email: "review@example.com" })).toBe(false);
      expect(mod.isOrderAllowlisted("stranger@example.com")).toBe(false);
    } finally {
      process.env.PAID_TESTERS_ORDER_ALLOWLIST = prev;
    }
  });
});
