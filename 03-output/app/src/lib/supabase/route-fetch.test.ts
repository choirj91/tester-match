// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { supabaseServerFetch } from "./route-fetch";

const env = { rest: "http://127.0.0.1:3001", auth: "http://127.0.0.1:9999/" };

describe("supabaseServerFetch", () => {
  test("no internal URLs → undefined (Supabase cloud unchanged)", () => {
    expect(supabaseServerFetch({})).toBeUndefined();
  });

  test("rest/v1 goes to PostgREST without the prefix, query kept", async () => {
    const base = vi.fn(async () => new Response("ok"));
    await supabaseServerFetch(env, base)!("https://tester-match.knockknock.company/rest/v1/apps?select=id&limit=1", { method: "GET" });
    expect(base).toHaveBeenCalledWith("http://127.0.0.1:3001/apps?select=id&limit=1", { method: "GET" });
  });

  test("auth/v1 goes to GoTrue (trailing slash on the base is fine)", async () => {
    const base = vi.fn(async () => new Response("ok"));
    await supabaseServerFetch(env, base)!("https://tester-match.knockknock.company/auth/v1/admin/users?page=1");
    expect(base).toHaveBeenCalledWith("http://127.0.0.1:9999/admin/users?page=1", undefined);
  });

  test("other paths pass through untouched", async () => {
    const base = vi.fn(async () => new Response("ok"));
    await supabaseServerFetch(env, base)!("https://example.com/storage/v1/object/x");
    expect(base).toHaveBeenCalledWith("https://example.com/storage/v1/object/x", undefined);
  });

  test("Request objects are rebuilt with the new URL and keep their method", async () => {
    const base = vi.fn(async (input: RequestInfo | URL) => new Response(String(input)));
    await supabaseServerFetch(env, base)!(new Request("https://x.test/rest/v1/rpc/f", { method: "POST", body: "{}" }));
    const req = base.mock.calls[0][0] as Request;
    expect(req.url).toBe("http://127.0.0.1:3001/rpc/f");
    expect(req.method).toBe("POST");
  });
});
