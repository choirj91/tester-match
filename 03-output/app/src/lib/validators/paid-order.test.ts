import { describe, expect, test } from "vitest";
import { PaidOrderCreateSchema } from "./paid-order";

describe("PaidOrderCreateSchema", () => {
  test("정상 입력을 통과시킨다", () => {
    const parsed = PaidOrderCreateSchema.parse({ app_id: 42, tester_count: 3 });
    expect(parsed).toEqual({ app_id: 42, tester_count: 3 });
  });

  test("문자열 숫자를 coerce 한다", () => {
    const parsed = PaidOrderCreateSchema.parse({ app_id: "42", tester_count: "10" });
    expect(parsed).toEqual({ app_id: 42, tester_count: 10 });
  });

  test("0명은 거부한다", () => {
    expect(() => PaidOrderCreateSchema.parse({ app_id: 1, tester_count: 0 })).toThrow();
  });

  test("11명은 거부한다", () => {
    expect(() => PaidOrderCreateSchema.parse({ app_id: 1, tester_count: 11 })).toThrow();
  });

  test("소수 인원은 거부한다", () => {
    expect(() => PaidOrderCreateSchema.parse({ app_id: 1, tester_count: 2.5 })).toThrow();
  });

  test("app_id 누락은 거부한다", () => {
    expect(() => PaidOrderCreateSchema.parse({ tester_count: 1 })).toThrow();
  });
});
