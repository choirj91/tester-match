// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/referrals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/referrals")>()),
  recordReferralForLogin: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { recordReferralForLogin } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

const session = { access_token: "t", user: { id: "auth-1" } };
const admin = {
  // 회원 행이 이미 있다 — 복구 경로는 바로 끝난다
  from: () => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      maybeSingle: async () => ({ data: { id: 31 }, error: null }),
    };
    return b;
  },
};

function exchange(result: { data: { session: unknown }; error: unknown }) {
  vi.mocked(createServerClient).mockReturnValue({
    auth: { exchangeCodeForSession: vi.fn(async () => result) },
  } as never);
}

const login = (cookie?: string) =>
  GET(
    new Request("http://localhost:3000/auth/callback?code=abc&next=/browse", {
      headers: cookie ? { cookie } : {},
    }),
  );

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

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
  vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
  exchange({ data: { session }, error: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("auth/callback — 추천 연결 (ADR-0019)", () => {
  test("추천 쿠키가 있으면 이 로그인으로 기록하고, 결과가 정해지면 쿠키를 지운다", async () => {
    vi.mocked(recordReferralForLogin).mockResolvedValue("recorded");
    const res = await login("__Host-tm_ref=15; other=1");

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/browse");
    expect(recordReferralForLogin).toHaveBeenCalledWith(admin, { authUserId: "auth-1", referrerUserId: 15 });
    expect(referralCookieCleared(res)).toBe(true);
  });

  test("기존 회원의 재로그인(invitee_not_new)도 쿠키를 지운다", async () => {
    vi.mocked(recordReferralForLogin).mockResolvedValue("invitee_not_new");
    expect(referralCookieCleared(await login("__Host-tm_ref=15"))).toBe(true);
  });

  test("일시 실패면 쿠키를 남겨 다음 로그인에서 다시 시도한다 — 로그인은 그대로 끝난다", async () => {
    vi.mocked(recordReferralForLogin).mockResolvedValue("error");
    const res = await login("__Host-tm_ref=15");
    expect(res.headers.get("location")).toBe("http://localhost:3000/browse");
    expect(referralCookieCleared(res)).toBe(false);
  });

  test("추천 기록이 2초를 넘기면 기다리지 않고 로그인을 마친다 — 쿠키는 남긴다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.mocked(recordReferralForLogin).mockReturnValue(new Promise(() => {}));

    const { value: res, elapsed } = await settleWithFakeTime(login("__Host-tm_ref=15"));

    expect(elapsed).toBeGreaterThanOrEqual(2000);
    expect(elapsed).toBeLessThanOrEqual(2200);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/browse");
    expect(referralCookieCleared(res)).toBe(false);
    expect(console.error).toHaveBeenCalledWith("[referrals] attribution timed out", { ms: 2000 });
  });

  test("추천 처리에서 예외가 나도 로그인은 막지 않는다", async () => {
    vi.mocked(recordReferralForLogin).mockRejectedValue(new Error("boom"));
    const res = await login("__Host-tm_ref=15");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/browse");
  });

  test("잘못된 쿠키 값은 기록하지 않고 지운다", async () => {
    const res = await login("__Host-tm_ref=abc");
    expect(recordReferralForLogin).not.toHaveBeenCalled();
    expect(referralCookieCleared(res)).toBe(true);
  });

  test("추천 쿠키가 없으면 아무것도 하지 않는다", async () => {
    const res = await login("other=1");
    expect(recordReferralForLogin).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").not.toContain("tm_ref");
  });

  test("로그인 교환이 실패하면 기록하지 않고 쿠키도 남긴다", async () => {
    exchange({ data: { session: null }, error: { code: "bad_code", message: "invalid" } });
    const res = await login("__Host-tm_ref=15");
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/login?error=exchange_failed");
    expect(recordReferralForLogin).not.toHaveBeenCalled();
    expect(referralCookieCleared(res)).toBe(false);
  });
});
