import { describe, expect, it } from "vitest";
import {
  AppImportBatchSchema,
  AppImportRowSchema,
  DEFAULT_IMPORT_SHORT_DESCRIPTION,
} from "./admin-app-import";

const validRow = {
  email: "user@example.com",
  app_name: "내 앱",
  store_invite_url: "https://play.google.com/apps/test/com.example/12345",
  web_invite_url: "https://play.google.com/apps/testing/com.example",
  short_description: "한 줄 설명",
};

describe("AppImportRowSchema", () => {
  it("accepts minimum required fields", () => {
    const r = AppImportRowSchema.parse(validRow);
    expect(r.required_testers).toBe(12); // default
    expect(r.status).toBe("matching"); // default
  });

  it("accepts optional nickname", () => {
    const r = AppImportRowSchema.parse({ ...validRow, nickname: "아무개" });
    expect(r.nickname).toBe("아무개");
  });

  it("treats null nickname as omitted", () => {
    const r = AppImportRowSchema.parse({ ...validRow, nickname: null });
    expect(r.nickname).toBeUndefined();
  });

  it("defaults null short_description", () => {
    const r = AppImportRowSchema.parse({ ...validRow, short_description: null });
    expect(r.short_description).toBe(DEFAULT_IMPORT_SHORT_DESCRIPTION);
  });

  it("defaults blank short_description", () => {
    const r = AppImportRowSchema.parse({ ...validRow, short_description: "   " });
    expect(r.short_description).toBe(DEFAULT_IMPORT_SHORT_DESCRIPTION);
  });

  it("accepts long short_description", () => {
    const value = "x".repeat(500);
    const r = AppImportRowSchema.parse({ ...validRow, short_description: value });
    expect(r.short_description).toBe(value);
  });

  it("defaults null required_testers to 12", () => {
    const r = AppImportRowSchema.parse({ ...validRow, required_testers: null });
    expect(r.required_testers).toBe(12);
  });

  it("rejects invalid email", () => {
    expect(AppImportRowSchema.safeParse({ ...validRow, email: "not-email" }).success).toBe(false);
  });

  it("rejects non-play.google.com URL", () => {
    expect(
      AppImportRowSchema.safeParse({
        ...validRow,
        store_invite_url: "https://example.com",
      }).success,
    ).toBe(false);
  });

  it("accepts required_testers 0", () => {
    expect(
      AppImportRowSchema.safeParse({ ...validRow, required_testers: 0 }).success,
    ).toBe(true);
  });

  it("rejects required_testers outside 0-100", () => {
    expect(
      AppImportRowSchema.safeParse({ ...validRow, required_testers: -1 }).success,
    ).toBe(false);
    expect(
      AppImportRowSchema.safeParse({ ...validRow, required_testers: 101 }).success,
    ).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(
      AppImportRowSchema.safeParse({ ...validRow, status: "deleted" }).success,
    ).toBe(false);
  });
});

describe("AppImportBatchSchema", () => {
  it("rejects empty batch", () => {
    expect(AppImportBatchSchema.safeParse([]).success).toBe(false);
  });

  it("rejects more than 200", () => {
    const big = new Array(201).fill(validRow);
    expect(AppImportBatchSchema.safeParse(big).success).toBe(false);
  });

  it("accepts batch of 1", () => {
    expect(AppImportBatchSchema.safeParse([validRow]).success).toBe(true);
  });
});
