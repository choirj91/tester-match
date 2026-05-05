import { describe, expect, it } from "vitest";
import { AppCommentCreateSchema, AppCommentUpdateSchema } from "./app-comment";

describe("AppCommentCreateSchema", () => {
  it("accepts body only", () => {
    expect(AppCommentCreateSchema.safeParse({ body: "안녕하세요" }).success).toBe(true);
  });

  it("accepts promoted_app_id", () => {
    const r = AppCommentCreateSchema.parse({ body: "내 앱도 부탁해요", promoted_app_id: 42 });
    expect(r.promoted_app_id).toBe(42);
  });

  it("accepts null promoted_app_id", () => {
    expect(AppCommentCreateSchema.safeParse({ body: "x", promoted_app_id: null }).success).toBe(true);
  });

  it("coerces string promoted_app_id", () => {
    const r = AppCommentCreateSchema.parse({ body: "x", promoted_app_id: "42" as unknown as number });
    expect(r.promoted_app_id).toBe(42);
  });

  it("rejects empty body", () => {
    expect(AppCommentCreateSchema.safeParse({ body: "  " }).success).toBe(false);
  });

  it("rejects over 1000 chars", () => {
    expect(AppCommentCreateSchema.safeParse({ body: "x".repeat(1001) }).success).toBe(false);
  });

  it("rejects non-positive promoted_app_id", () => {
    expect(AppCommentCreateSchema.safeParse({ body: "x", promoted_app_id: 0 }).success).toBe(false);
    expect(AppCommentCreateSchema.safeParse({ body: "x", promoted_app_id: -1 }).success).toBe(false);
  });

  it("trims whitespace", () => {
    expect(AppCommentCreateSchema.parse({ body: "  hi  " }).body).toBe("hi");
  });
});

describe("AppCommentUpdateSchema", () => {
  it("only allows body", () => {
    const r = AppCommentUpdateSchema.parse({ body: "edit" });
    expect(r.body).toBe("edit");
    expect("promoted_app_id" in r).toBe(false);
  });
});
