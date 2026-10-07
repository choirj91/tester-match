// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

// 링크는 인증 서버를 부르지 않는다 — 불리면 실패하게 둔다
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => {
    throw new Error("must not check login");
  }),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "./route";

const visit = (id: string, cookie?: string) =>
  GET(new Request(`http://localhost:3000/r/${id}`, { headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ id }),
  });

describe("GET /r/[id] — 추천 링크", () => {
  test("추천 쿠키(__Host-, 30일, HttpOnly, Secure, Lax, Path=/)를 남기고 첫 화면으로 307", async () => {
    const res = await visit("15");

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-tm_ref=15;/);
    expect(cookie).toMatch(/Max-Age=2592000/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("이미 쿠키가 있어도 마지막으로 연 링크로 덮어쓴다", async () => {
    const res = await visit("21", "__Host-tm_ref=15");
    expect(res.headers.get("set-cookie")).toMatch(/^__Host-tm_ref=21;/);
  });

  test.each(["0", "abc", "1.5", "-3", "99999999999999999"])(
    "잘못된 id %j: 쿠키 없이 첫 화면으로",
    async (id) => {
      const res = await visit(id);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/");
      expect(res.headers.get("set-cookie")).toBeNull();
    },
  );
});
