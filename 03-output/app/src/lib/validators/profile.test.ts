import { describe, expect, it } from "vitest";
import { ProfileUpdateSchema } from "./profile";

describe("ProfileUpdateSchema", () => {
  it("accepts valid nickname", () => {
    expect(ProfileUpdateSchema.safeParse({ nickname: "최콜록" }).success).toBe(true);
  });

  it("trims whitespace", () => {
    const r = ProfileUpdateSchema.parse({ nickname: "  hi  " });
    expect(r.nickname).toBe("hi");
  });

  it("rejects empty / whitespace-only", () => {
    expect(ProfileUpdateSchema.safeParse({ nickname: "" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ nickname: "   " }).success).toBe(false);
  });

  it("rejects over 32 chars", () => {
    expect(ProfileUpdateSchema.safeParse({ nickname: "x".repeat(33) }).success).toBe(false);
  });
});
