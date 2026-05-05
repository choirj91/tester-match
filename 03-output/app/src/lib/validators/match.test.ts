import { describe, expect, it } from "vitest";
import { MatchOptInSchema, MatchOptOutSchema } from "./match";

describe("MatchOptInSchema", () => {
  it("accepts positive integer app_id", () => {
    expect(MatchOptInSchema.safeParse({ app_id: 1 }).success).toBe(true);
    expect(MatchOptInSchema.safeParse({ app_id: 999 }).success).toBe(true);
  });

  it("coerces numeric strings", () => {
    const r = MatchOptInSchema.parse({ app_id: "42" as unknown as number });
    expect(r.app_id).toBe(42);
  });

  it("rejects 0 / negative", () => {
    expect(MatchOptInSchema.safeParse({ app_id: 0 }).success).toBe(false);
    expect(MatchOptInSchema.safeParse({ app_id: -1 }).success).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(MatchOptInSchema.safeParse({ app_id: 1.5 }).success).toBe(false);
  });

  it("rejects missing", () => {
    expect(MatchOptInSchema.safeParse({}).success).toBe(false);
  });
});

describe("MatchOptOutSchema", () => {
  it("allows empty body (no reason)", () => {
    expect(MatchOptOutSchema.safeParse({}).success).toBe(true);
  });

  it("accepts reason within length", () => {
    expect(MatchOptOutSchema.safeParse({ reason: "더 이상 사용 안 함" }).success).toBe(true);
  });

  it("rejects reason over 500 chars", () => {
    expect(
      MatchOptOutSchema.safeParse({ reason: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects whitespace-only reason", () => {
    expect(MatchOptOutSchema.safeParse({ reason: "   " }).success).toBe(false);
  });
});
