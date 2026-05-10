import { describe, expect, it } from "vitest";
import { AppCreateSchema, AppUpdateSchema } from "./app";

describe("AppCreateSchema", () => {
  const valid = {
    nickname: "닉",
    name: "내 앱",
    store_invite_url: "https://play.google.com/apps/test/com.example.app/12345",
    web_invite_url: "https://play.google.com/apps/testing/com.example.app",
    required_testers: 12,
    short_description: "한 줄 설명",
  };

  it("accepts valid input", () => {
    const result = AppCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects non-play.google.com URL", () => {
    const r = AppCreateSchema.safeParse({
      ...valid,
      store_invite_url: "https://example.com/app",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("play.google.com");
    }
  });

  it("rejects required_testers > 100", () => {
    const r = AppCreateSchema.safeParse({ ...valid, required_testers: 101 });
    expect(r.success).toBe(false);
  });

  it("accepts required_testers 0", () => {
    const r = AppCreateSchema.safeParse({ ...valid, required_testers: 0 });
    expect(r.success).toBe(true);
  });

  it("rejects required_testers < 0", () => {
    const r = AppCreateSchema.safeParse({ ...valid, required_testers: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects empty nickname", () => {
    const r = AppCreateSchema.safeParse({ ...valid, nickname: "   " });
    expect(r.success).toBe(false);
  });

  it("trims whitespace", () => {
    const r = AppCreateSchema.parse({ ...valid, name: "  hello  " });
    expect(r.name).toBe("hello");
  });

  it("accepts long short_description", () => {
    const r = AppCreateSchema.safeParse({ ...valid, short_description: "x".repeat(500) });
    expect(r.success).toBe(true);
  });

  it("coerces numeric strings for required_testers", () => {
    const r = AppCreateSchema.parse({ ...valid, required_testers: "5" as unknown as number });
    expect(r.required_testers).toBe(5);
  });
});

describe("AppUpdateSchema", () => {
  it("allows partial input", () => {
    expect(AppUpdateSchema.safeParse({}).success).toBe(true);
    expect(AppUpdateSchema.safeParse({ name: "new" }).success).toBe(true);
  });

  it("validates status enum", () => {
    expect(AppUpdateSchema.safeParse({ status: "matching" }).success).toBe(true);
    expect(AppUpdateSchema.safeParse({ status: "invalid" }).success).toBe(false);
  });
});
