// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/referrals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/referrals")>()),
  recordReferralForLogin: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { recordReferralForLogin } from "@/lib/referrals";
import { CONFIRM_COOKIE } from "@/lib/signup-confirm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

const ORIGIN = "http://localhost:3000";

function adminStub(memberOutcome: { data: unknown; error: unknown }) {
  return {
    auth: {
      admin: {
        updateUserById: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
    rpc: vi.fn(async () => memberOutcome),
  };
}

function submit() {
  const form = new FormData();
  form.set("nickname", "새회원");
  form.set("kakao_nickname", "새회원톡");
  form.set("password", "correct-horse-battery-9");
  form.set("password_confirm", "correct-horse-battery-9");
  form.set("agreed", "on");
  return POST(
    new Request(`${ORIGIN}/api/auth/confirm`, { method: "POST", headers: { origin: ORIGIN }, body: form }),
  );
}

const referralCookieCleared = (res: Response) =>
  /(^|,\s*)__Host-tm_ref=;.*Max-Age=0/i.test(res.headers.get("set-cookie") ?? "");

/** 가짜 시계를 100ms 씩 넘기며 응답이 나올 때까지 기다린다. 걸린 가짜 시간(ms)도 돌려준다 */
async function settleWithFakeTime<T>(p: Promise<T>): Promise<{ value: T; elapsed: number }> {
  let done = false;
  void p.finally(() => {
    done = true;
  });
  let elapsed = 0;
  for (; elapsed < 5000 && !done; elapsed += 100) await vi.advanceTimersByTimeAsync(100);
  return { value: await p, elapsed };
}

let admin = adminStub({ data: "linked", error: null });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
  vi.spyOn(console, "error").mockImplementation(() => {});
  cookieJar.clear();
  cookieJar.set(CONFIRM_COOKIE, "a".repeat(40));
  vi.mocked(createClient).mockReturnValue({
    auth: {
      verifyOtp: vi.fn(async () => ({
        data: { user: { id: "auth-1", created_at: new Date().toISOString() }, session: { access_token: "t" } },
        error: null,
      })),
    },
  } as never);
  admin = adminStub({ data: "linked", error: null });
  vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/auth/confirm — 추천 연결 (ADR-0019)", () => {
  test("회원 행을 만든 뒤 추천을 기록하고, 결과가 정해지면 추천 쿠키를 지운다", async () => {
    cookieJar.set("__Host-tm_ref", "15");
    vi.mocked(recordReferralForLogin).mockResolvedValue("recorded");

    const res = await submit();

    expect(res.headers.get("location")).toBe(`${ORIGIN}/auth/login?verified=1`);
    expect(admin.rpc).toHaveBeenCalledWith("create_email_member", expect.anything());
    expect(recordReferralForLogin).toHaveBeenCalledWith(admin, { authUserId: "auth-1", referrerUserId: 15 });
    expect(vi.mocked(admin.rpc).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(recordReferralForLogin).mock.invocationCallOrder[0],
    );
    expect(referralCookieCleared(res)).toBe(true);
  });

  test("추천 기록이 일시 실패해도 가입은 성공 — 추천 쿠키는 남긴다", async () => {
    cookieJar.set("__Host-tm_ref", "15");
    vi.mocked(recordReferralForLogin).mockResolvedValue("error");
    const res = await submit();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/auth/login?verified=1`);
    expect(referralCookieCleared(res)).toBe(false);
  });

  test("추천 기록이 2초를 넘기면 기다리지 않고 가입을 마친다 — 추천 쿠키는 남긴다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    cookieJar.set("__Host-tm_ref", "15");
    vi.mocked(recordReferralForLogin).mockReturnValue(new Promise(() => {}));

    const { value: res, elapsed } = await settleWithFakeTime(submit());

    expect(elapsed).toBeGreaterThanOrEqual(2000);
    expect(elapsed).toBeLessThanOrEqual(2200);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/auth/login?verified=1`);
    expect(referralCookieCleared(res)).toBe(false);
    expect(console.error).toHaveBeenCalledWith("[referrals] attribution timed out", { ms: 2000 });
  });

  test("회원 행을 만들지 못하면 추천을 기록하지 않고 쿠키도 남긴다", async () => {
    cookieJar.set("__Host-tm_ref", "15");
    admin = adminStub({ data: null, error: { code: "XX000" } });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    const res = await submit();
    expect(res.headers.get("location")).toContain("/auth/login?error=");
    expect(recordReferralForLogin).not.toHaveBeenCalled();
    expect(referralCookieCleared(res)).toBe(false);
  });

  test("잘못된 추천 쿠키는 기록하지 않고 가입이 끝나면 지운다", async () => {
    cookieJar.set("__Host-tm_ref", "abc");
    const res = await submit();
    expect(recordReferralForLogin).not.toHaveBeenCalled();
    expect(referralCookieCleared(res)).toBe(true);
  });

  test("추천 쿠키가 없으면 추천 처리를 하지 않는다", async () => {
    const res = await submit();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/auth/login?verified=1`);
    expect(recordReferralForLogin).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").not.toContain("tm_ref");
  });
});
