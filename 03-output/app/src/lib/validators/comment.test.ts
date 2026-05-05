import { describe, expect, it } from "vitest";
import { CommentCreateSchema } from "./comment";

describe("CommentCreateSchema", () => {
  it("accepts valid body", () => {
    expect(CommentCreateSchema.safeParse({ body: "댓글" }).success).toBe(true);
  });

  it("rejects empty body", () => {
    expect(CommentCreateSchema.safeParse({ body: "  " }).success).toBe(false);
  });

  it("rejects over 2000 chars", () => {
    expect(CommentCreateSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
  });

  it("trims whitespace", () => {
    const r = CommentCreateSchema.parse({ body: "  hi  " });
    expect(r.body).toBe("hi");
  });
});
