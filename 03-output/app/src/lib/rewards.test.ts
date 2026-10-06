import { describe, expect, test } from "vitest";
import {
  CREDIT_RULES,
  REWARD_CATALOG,
  REWARD_KINDS,
  isRewardKind,
  rewardLedgerDescription,
} from "./rewards";

describe("보상 교환 상점", () => {
  test("모든 보상 종류에 카탈로그 항목이 있다", () => {
    for (const kind of REWARD_KINDS) {
      expect(REWARD_CATALOG[kind].kind).toBe(kind);
      expect(REWARD_CATALOG[kind].label.length).toBeGreaterThan(0);
    }
  });

  test.each([
    ["gifticon", true],
    ["naver_points", true],
    ["cash", false],
    ["", false],
    [null, false],
    [3, false],
  ])("isRewardKind(%j) → %s", (value, expected) => {
    expect(isRewardKind(value)).toBe(expected);
  });

  test("원장 설명에 보상 이름이 들어간다", () => {
    expect(rewardLedgerDescription("naver_points")).toBe("보상 교환 신청 (네이버페이 포인트)");
    expect(rewardLedgerDescription("gifticon")).toBe("보상 교환 신청 (기프티콘)");
  });

  test("크레딧 규칙은 구매·양도·현금 환급 불가를 모두 말한다", () => {
    const text = CREDIT_RULES.join(" ");
    expect(text).toContain("구매할 수 없습니다");
    expect(text).toContain("양도");
    expect(text).toContain("현금으로 환급되지 않습니다");
  });
});
