import { describe, expect, it } from "vitest";
import { POST_CATEGORIES, PostCreateSchema, PostUpdateSchema } from "./post";

describe("PostCreateSchema", () => {
  const valid = { category: "자유", title: "안녕", body: "본문" } as const;

  it("accepts valid input", () => {
    expect(PostCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid category", () => {
    expect(PostCreateSchema.safeParse({ ...valid, category: "잡담" }).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(PostCreateSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  it("rejects title over 120 chars", () => {
    expect(
      PostCreateSchema.safeParse({ ...valid, title: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("rejects body over 10000 chars", () => {
    expect(
      PostCreateSchema.safeParse({ ...valid, body: "x".repeat(10001) }).success,
    ).toBe(false);
  });

  it("exposes 4 categories", () => {
    expect(POST_CATEGORIES).toEqual(["자유", "질문", "공유", "구인"]);
  });
});

describe("PostUpdateSchema", () => {
  it("allows partial", () => {
    expect(PostUpdateSchema.safeParse({}).success).toBe(true);
    expect(PostUpdateSchema.safeParse({ title: "수정" }).success).toBe(true);
  });
});
