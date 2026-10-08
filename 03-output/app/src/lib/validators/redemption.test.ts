import { describe, expect, test } from "vitest";
import { RedemptionCreateSchema } from "./redemption";

describe("RedemptionCreateSchema", () => {
  const valid = { item_code: "npay_5000", quantity: 1, contact: "010-1234-5678" };

  test("정상 입력을 통과시키고 메모 기본값은 빈 문자열", () => {
    expect(RedemptionCreateSchema.parse(valid)).toEqual({ ...valid, note: "" });
  });

  test("금액·종류 같은 알 수 없는 키는 버린다", () => {
    const parsed = RedemptionCreateSchema.parse({ ...valid, amount: 1, kind: "gifticon" });
    expect(parsed).not.toHaveProperty("amount");
    expect(parsed).not.toHaveProperty("kind");
  });

  test("수량은 문자열 숫자도 받는다", () => {
    expect(RedemptionCreateSchema.parse({ ...valid, quantity: "3" }).quantity).toBe(3);
  });

  test.each([0, -2, 1.5, "abc", null, undefined])("수량 %j 는 거절", (quantity) => {
    expect(RedemptionCreateSchema.safeParse({ ...valid, quantity }).success).toBe(false);
  });

  test("상품 코드가 없으면 거절", () => {
    expect(RedemptionCreateSchema.safeParse({ ...valid, item_code: "  " }).success).toBe(false);
    expect(RedemptionCreateSchema.safeParse({ quantity: 1, contact: valid.contact }).success).toBe(false);
  });

  test("휴대폰 번호 형식이 아니면 거절", () => {
    expect(RedemptionCreateSchema.safeParse({ ...valid, contact: "02-123-4567" }).success).toBe(false);
  });

  test("메모 200자 초과·NUL 문자는 거절", () => {
    expect(RedemptionCreateSchema.safeParse({ ...valid, note: "가".repeat(201) }).success).toBe(false);
    expect(RedemptionCreateSchema.safeParse({ ...valid, note: "a\u0000b" }).success).toBe(false);
  });
});
