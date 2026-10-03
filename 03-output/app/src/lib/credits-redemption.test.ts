import { describe, expect, test } from "vitest";
import { redeemableFromRows } from "./credits";

describe("redeemableFromRows", () => {
  test("유료 시트 적립만 교환 가능액에 포함된다", () => {
    expect(
      redeemableFromRows([
        { type: "earn", amount: 700, ref_type: "paid_seat" },
        { type: "earn", amount: 800, ref_type: "match" },
        { type: "earn", amount: 3000, ref_type: "ranking_reward" },
      ]),
    ).toBe(700);
  });

  test("교환 차감은 빼고 거절 환급은 더한다", () => {
    expect(
      redeemableFromRows([
        { type: "earn", amount: 7000, ref_type: "paid_seat" },
        { type: "spend", amount: -5000, ref_type: "redemption" },
        { type: "refund", amount: 5000, ref_type: "redemption" },
        { type: "spend", amount: -5000, ref_type: "redemption" },
      ]),
    ).toBe(2000);
  });

  test("보상 몰수(penalty)도 교환 가능액을 줄인다", () => {
    expect(
      redeemableFromRows([
        { type: "earn", amount: 700, ref_type: "paid_seat" },
        { type: "penalty", amount: -700, ref_type: "paid_seat" },
      ]),
    ).toBe(0);
  });

  test("음수로 떨어지지 않는다", () => {
    expect(redeemableFromRows([{ type: "spend", amount: -100, ref_type: "redemption" }])).toBe(0);
  });
});
