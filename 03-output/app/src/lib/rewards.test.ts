import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  CREDIT_RULES,
  REDEMPTION_MAX_CREDITS,
  REDEMPTION_MAX_QUANTITY,
  REWARD_ITEMS,
  REWARD_KINDS,
  REWARD_KIND_LABEL,
  REWARD_MIN_ITEM_CREDITS,
  findRewardItem,
  isRewardKind,
  quoteRedemption,
  redemptionLabel,
  rewardItemTitle,
  rewardLedgerDescription,
  rewardMaxQuantity,
} from "./rewards";

/** 크레딧 맥락에서 쓰지 않는 말 (ADR-0017 Decision 7, PG 심사) */
const FORBIDDEN_WORDS = ["구매", "구입", "충전", "환전", "현금", "환급", "판매", "결제"];

describe("보상 종류", () => {
  test("모든 보상 종류에 이름이 있다", () => {
    for (const kind of REWARD_KINDS) {
      expect(REWARD_KIND_LABEL[kind].length).toBeGreaterThan(0);
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
});

describe("교환 상품 카탈로그", () => {
  test("상품 코드는 겹치지 않고 DB 형식 검사(^[a-z0-9_]{1,64}$)를 통과한다", () => {
    const codes = REWARD_ITEMS.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z0-9_]{1,64}$/);
  });

  test("모든 상품은 종류·크레딧·아이콘이 올바르고 1개 이상 신청할 수 있다", () => {
    for (const item of REWARD_ITEMS) {
      expect(isRewardKind(item.kind)).toBe(true);
      expect(Number.isInteger(item.credits)).toBe(true);
      expect(item.credits).toBeGreaterThan(0);
      expect(item.credits).toBeLessThanOrEqual(REDEMPTION_MAX_CREDITS);
      expect(["Coffee", "Wallet"]).toContain(item.icon);
      expect(rewardMaxQuantity(item)).toBeGreaterThanOrEqual(1);
    }
  });

  test("상품 이미지는 아직 쓰지 않는다 (제3자 사진·로고 미사용)", () => {
    expect(REWARD_ITEMS.every((item) => item.imageUrl === undefined)).toBe(true);
  });

  test("상품 문구에 구매·충전·현금 같은 말이 없다", () => {
    const text = REWARD_ITEMS.map((item) => `${item.brand} ${item.name} ${item.deliveryNote}`).join(" ");
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });

  test("가장 싼 상품의 크레딧", () => {
    expect(REWARD_MIN_ITEM_CREDITS).toBe(Math.min(...REWARD_ITEMS.map((item) => item.credits)));
  });

  test("상품 이름은 브랜드 + 상품명", () => {
    const item = findRewardItem("starbucks_americano_t");
    expect(item && rewardItemTitle(item)).toBe("스타벅스 카페 아메리카노 T");
    expect(item?.credits).toBe(4700);
  });

  test.each([["nope"], [""], [null], [undefined], [42]])("모르는 코드 %j → null", (code) => {
    expect(findRewardItem(code)).toBeNull();
  });
});

describe("rewardMaxQuantity", () => {
  test("수량 상한 10과 1회 50,000 크레딧 상한 중 작은 쪽", () => {
    expect(rewardMaxQuantity({ credits: 1500 })).toBe(10);
    expect(rewardMaxQuantity({ credits: 4700 })).toBe(10);
    expect(rewardMaxQuantity({ credits: 5000 })).toBe(10);
    expect(rewardMaxQuantity({ credits: 10000 })).toBe(5);
    expect(rewardMaxQuantity({ credits: 60000 })).toBe(0);
  });
});

describe("quoteRedemption", () => {
  test("상품 크레딧 × 수량", () => {
    const quote = quoteRedemption("starbucks_americano_t", 2);
    expect(quote).toMatchObject({ ok: true, quantity: 2, total: 9400 });
  });

  test("1회 50,000 크레딧까지는 된다", () => {
    expect(quoteRedemption("npay_10000", 5)).toMatchObject({ ok: true, total: 50000 });
  });

  test("50,000 크레딧을 넘으면 거절", () => {
    const quote = quoteRedemption("npay_10000", 6);
    expect(quote).toEqual({ ok: false, message: "한 번에 50,000 크레딧까지 교환할 수 있습니다." });
  });

  test("수량 상한을 넘으면 거절", () => {
    const quote = quoteRedemption("compose_americano_hot", REDEMPTION_MAX_QUANTITY + 1);
    expect(quote.ok).toBe(false);
  });

  test.each([0, -1, 1.5, Number.NaN])("수량 %s 는 거절", (quantity) => {
    expect(quoteRedemption("npay_5000", quantity).ok).toBe(false);
  });

  test("모르는 상품은 거절", () => {
    expect(quoteRedemption("cash_10000", 1)).toEqual({
      ok: false,
      message: "교환할 수 없는 상품입니다. 목록에서 다시 골라주세요.",
    });
  });
});

describe("표시 문구", () => {
  test("원장 설명에 상품과 수량이 들어간다", () => {
    const item = findRewardItem("starbucks_americano_t");
    expect(item && rewardLedgerDescription(item, 1)).toBe("보상 교환 신청 (스타벅스 카페 아메리카노 T ×1)");
  });

  test("새 신청은 상품 × 수량, 이전 신청은 보상 종류 이름", () => {
    expect(redemptionLabel({ kind: "naver_points", item_code: "npay_5000", quantity: 3 })).toBe(
      "네이버페이 포인트 5,000원권 ×3",
    );
    expect(redemptionLabel({ kind: "gifticon", item_code: null, quantity: null })).toBe("기프티콘");
    expect(redemptionLabel({ kind: "naver_points", item_code: null, quantity: null })).toBe("네이버페이 포인트");
  });

  test("카탈로그에서 빠진 상품 코드는 코드를 그대로 보여 준다", () => {
    expect(redemptionLabel({ kind: "gifticon", item_code: "old_item", quantity: 2 })).toBe("기프티콘 (old_item ×2)");
  });

  test("크레딧 규칙은 구매·양도·현금 환급 불가를 모두 말한다", () => {
    const text = CREDIT_RULES.join(" ");
    expect(text).toContain("구매할 수 없습니다");
    expect(text).toContain("양도");
    expect(text).toContain("현금으로 환급되지 않습니다");
  });
});

describe("앱 상수 = DB 제약", () => {
  test("수량 상한 10 — 마이그레이션의 CHECK 와 같다", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/20261008000001_redemption_item.sql"),
      "utf8",
    );
    expect(sql).toContain(`check (quantity between 1 and ${REDEMPTION_MAX_QUANTITY})`);
  });
});
