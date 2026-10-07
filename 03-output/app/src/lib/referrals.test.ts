import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }));

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import {
  REFERRAL_ATTRIBUTION_WINDOW_MS,
  REFERRAL_CAP_PER_WINDOW,
  REFERRAL_CAP_WINDOW_DAYS,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_TRUST_DELTA,
  emptyReferralSummary,
  getReferralStats,
  grantReferralRewards,
  isReferralSettled,
  isWithinAttributionWindow,
  parseCandidateIds,
  parseGrantResult,
  parseReferralCode,
  rankReferrers,
  readReferralCookie,
  recordReferral,
  recordReferralForLogin,
  referralCookieOptions,
  referralLink,
  settledReferralCount,
  withAttributionTimeout,
} from "./referrals";

type Result = { data?: unknown; error?: { code?: string; message: string } | null; count?: number };
type Call = {
  table: string;
  op: "select" | "insert";
  columns?: string;
  values?: unknown;
  filters: Record<string, unknown>;
  in: Record<string, unknown[]>;
  is: Record<string, unknown>;
  not: Record<string, unknown>;
  gt: Record<string, unknown>;
  limit?: number;
};

/** PostgREST 빌더 흉내 — 체인은 자기 자신, await 하면 respond(call) 결과. 호출 조건을 calls 에 남긴다 */
function fakeSupabase(
  respond: (call: Call) => Result,
  rpcRespond: (params: Record<string, unknown>, name: string) => Result = () => ({ data: "granted", error: null }),
) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: {}, in: {}, is: {}, not: {}, gt: {} };
    calls.push(call);
    const builder: Record<string, unknown> = {
      select(columns: string) {
        call.columns = columns;
        return builder;
      },
      insert(values: unknown) {
        call.op = "insert";
        call.values = values;
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters[column] = value;
        return builder;
      },
      in(column: string, values: unknown[]) {
        call.in[column] = values;
        return builder;
      },
      is(column: string, value: unknown) {
        call.is[column] = value;
        return builder;
      },
      not(column: string, _op: string, value: unknown) {
        call.not[column] = value;
        return builder;
      },
      gt(column: string, value: unknown) {
        call.gt[column] = value;
        return builder;
      },
      order: () => builder,
      limit(n: number) {
        call.limit = n;
        return builder;
      },
      range: () => builder,
      maybeSingle: () => Promise.resolve(respond(call)),
      then: (resolve: (r: Result) => unknown) => Promise.resolve(respond(call)).then(resolve),
    };
    return builder;
  };
  const rpc = vi.fn((name: string, params: Record<string, unknown>) => Promise.resolve(rpcRespond(params, name)));
  return { client: { from, rpc } as unknown as SupabaseClient, calls, rpc };
}

const NOW = Date.parse("2026-10-07T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("parseReferralCode", () => {
  test.each([
    ["7", 7],
    ["123456", 123456],
    ["9007199254740991", 9007199254740991],
  ])("양의 정수 회원 id %s → %d", (input, expected) => {
    expect(parseReferralCode(input)).toBe(expected);
  });

  test.each(["0", "007", "-1", "1.5", "1e3", " 7", "7 ", "abc", "", "12345678901234567", "9007199254740993"])(
    "잘못된 값 %j 은 null",
    (input) => {
      expect(parseReferralCode(input)).toBeNull();
    },
  );

  test("문자열이 아니면 null", () => {
    expect(parseReferralCode(7)).toBeNull();
    expect(parseReferralCode(undefined)).toBeNull();
  });

  test("링크는 /r/{id}", () => {
    expect(referralLink("https://example.test", 42)).toBe("https://example.test/r/42");
  });
});

describe("추천 쿠키", () => {
  test("이름은 __Host- 접두사 — 다른 서브도메인이 덮어쓸 수 없다", () => {
    expect(REFERRAL_COOKIE).toBe("__Host-tm_ref");
  });

  test("Cookie 헤더에서 원문을 꺼낸다 (잘못된 값도 — 지워야 하므로)", () => {
    expect(readReferralCookie(`a=1; ${REFERRAL_COOKIE}=15; b=2`)).toBe("15");
    expect(readReferralCookie(`${REFERRAL_COOKIE}=oops`)).toBe("oops");
    expect(readReferralCookie("tm_ref=3; x=1")).toBeNull();
    expect(readReferralCookie(null)).toBeNull();
  });

  test.each(["production", "development"])("%s: HttpOnly·Lax·Secure·경로 /·30일 (__Host- 조건)", (env) => {
    vi.stubEnv("NODE_ENV", env);
    expect(referralCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    expect(REFERRAL_COOKIE_MAX_AGE_SECONDS).toBe(2_592_000);
    expect(referralCookieOptions(0).maxAge).toBe(0);
  });
});

describe("isWithinAttributionWindow — 24시간 안에 만들어진 회원 행만", () => {
  test("경계", () => {
    expect(isWithinAttributionWindow(iso(NOW - 1000), NOW)).toBe(true);
    expect(isWithinAttributionWindow(iso(NOW - REFERRAL_ATTRIBUTION_WINDOW_MS), NOW)).toBe(true);
    expect(isWithinAttributionWindow(iso(NOW - REFERRAL_ATTRIBUTION_WINDOW_MS - 1), NOW)).toBe(false);
  });

  test("서버 시계 차이 5분까지의 미래 시각은 새 회원, 그 이상은 아니다", () => {
    expect(isWithinAttributionWindow(iso(NOW + 4 * 60 * 1000), NOW)).toBe(true);
    expect(isWithinAttributionWindow(iso(NOW + 6 * 60 * 1000), NOW)).toBe(false);
  });

  test("KST 오프셋 표기도 같은 시각으로 읽는다", () => {
    // NOW(12:00Z) = 21:00 KST. 1시간 전 = 20:00 KST
    expect(isWithinAttributionWindow("2026-10-07T20:00:00+09:00", NOW)).toBe(true);
    expect(isWithinAttributionWindow("2026-10-06T20:59:59+09:00", NOW)).toBe(false);
  });

  test("읽을 수 없는 시각은 새 회원이 아니다", () => {
    expect(isWithinAttributionWindow("not-a-date", NOW)).toBe(false);
  });
});

type Member = { id: number; status: string; deleted_at: string | null; created_at: string };
const referrer: Member = { id: 2, status: "active", deleted_at: null, created_at: iso(NOW - 90 * 24 * HOUR) };
const newInvitee: Member = { id: 9, status: "active", deleted_at: null, created_at: iso(NOW - HOUR) };

function membersDb(members: Member[], insertResult: Result = { error: null }) {
  return fakeSupabase((call) => {
    if (call.table === "users") {
      const ids = call.in.id ?? [];
      return { data: members.filter((m) => ids.includes(m.id)), error: null };
    }
    if (call.table === "referrals" && call.op === "insert") return insertResult;
    throw new Error(`unexpected ${call.table}`);
  });
}

describe("recordReferral", () => {
  test("새 회원이면 추천인·피추천인 한 행을 기록한다", async () => {
    const { client, calls } = membersDb([referrer, newInvitee]);
    const outcome = await recordReferral(client, { inviteeUserId: 9, referrerUserId: 2, now: NOW });
    expect(outcome).toBe("recorded");
    expect(calls.filter((c) => c.table === "users")).toHaveLength(1);
    expect(calls.find((c) => c.op === "insert")?.values).toEqual({ referrer_user_id: 2, invitee_user_id: 9 });
  });

  test("자기 자신은 DB 를 보지 않고 거절", async () => {
    const { client, calls } = membersDb([referrer]);
    expect(await recordReferral(client, { inviteeUserId: 2, referrerUserId: 2, now: NOW })).toBe("self");
    expect(calls).toHaveLength(0);
  });

  test.each([
    ["없는 추천인", [newInvitee]],
    ["탈퇴한 추천인", [{ ...referrer, status: "withdrawn", deleted_at: iso(NOW - HOUR) }, newInvitee]],
    ["정지된 추천인", [{ ...referrer, status: "suspended" }, newInvitee]],
  ])("%s → referrer_ineligible, 기록 없음", async (_label, members) => {
    const { client, calls } = membersDb(members as Member[]);
    expect(await recordReferral(client, { inviteeUserId: 9, referrerUserId: 2, now: NOW })).toBe(
      "referrer_ineligible",
    );
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  test("24시간보다 오래된 회원(기존 회원의 재로그인)은 기록하지 않는다", async () => {
    const old = { ...newInvitee, created_at: iso(NOW - 25 * HOUR) };
    const { client, calls } = membersDb([referrer, old]);
    expect(await recordReferral(client, { inviteeUserId: 9, referrerUserId: 2, now: NOW })).toBe(
      "invitee_not_new",
    );
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  test("이미 추천된 피추천인 (unique 위반) → already_referred, 오류 로그 없음", async () => {
    const { client } = membersDb([referrer, newInvitee], {
      error: { code: "23505", message: "duplicate key" },
    });
    expect(await recordReferral(client, { inviteeUserId: 9, referrerUserId: 2, now: NOW })).toBe(
      "already_referred",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  test("그 밖의 쓰기 실패는 error 로 돌려주고 로그를 남긴다 (개인정보 없이)", async () => {
    const { client } = membersDb([referrer, newInvitee], { error: { code: "XX000", message: "boom" } });
    expect(await recordReferral(client, { inviteeUserId: 9, referrerUserId: 2, now: NOW })).toBe("error");
    expect(console.error).toHaveBeenCalledWith("[referrals] insert failed", "XX000");
  });

  test("회원 조회 실패 → error", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { code: "57014", message: "timeout" } }));
    expect(await recordReferral(client, { inviteeUserId: 9, referrerUserId: 2, now: NOW })).toBe("error");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("isReferralSettled — 쿠키를 지워도 되는 결과", () => {
  test.each([
    ["recorded", true],
    ["already_referred", true],
    ["self", true],
    ["referrer_ineligible", true],
    ["invitee_not_new", true],
    ["error", false],
    ["no_member", false],
    ["timeout", false],
  ] as const)("%s → %s", (outcome, settled) => {
    expect(isReferralSettled(outcome)).toBe(settled);
  });
});

describe("recordReferralForLogin — 로그인을 막지 않는다", () => {
  test("로그인의 회원 행 id 로 기록한다", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "users" && call.filters.auth_user_id) return { data: { id: 9 }, error: null };
      if (call.table === "users") {
        const ids = call.in.id ?? [];
        return {
          data: [referrer, { ...newInvitee, created_at: iso(Date.now() - HOUR) }].filter((m) =>
            ids.includes(m.id),
          ),
          error: null,
        };
      }
      return { error: null };
    });
    expect(await recordReferralForLogin(client, { authUserId: "auth-uuid", referrerUserId: 2 })).toBe(
      "recorded",
    );
    expect(calls[0]?.filters).toEqual({ auth_user_id: "auth-uuid" });
  });

  test("회원 행이 없는 로그인 → no_member", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: null }));
    expect(await recordReferralForLogin(client, { authUserId: "x", referrerUserId: 2 })).toBe("no_member");
  });

  test("예외가 나도 던지지 않는다", async () => {
    const client = {
      from: () => {
        throw new Error("network down");
      },
    } as unknown as SupabaseClient;
    await expect(recordReferralForLogin(client, { authUserId: "x", referrerUserId: 2 })).resolves.toBe("error");
    expect(console.error).toHaveBeenCalledWith("[referrals] attribution failed", "network down");
  });
});

describe("withAttributionTimeout — 로그인을 늘어지게 하지 않는다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("상한 안에 끝나면 그 결과", async () => {
    await expect(withAttributionTimeout(Promise.resolve("recorded"), 2000)).resolves.toBe("recorded");
  });

  test("상한(2초)을 넘기면 timeout 을 돌려주고 기다리지 않는다", async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const pending = withAttributionTimeout(never);
    await vi.advanceTimersByTimeAsync(1999);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe("timeout");
    expect(console.error).toHaveBeenCalledWith("[referrals] attribution timed out", { ms: 2000 });
  });

  test("예외는 error 로 바꾼다 (던지지 않는다)", async () => {
    await expect(withAttributionTimeout(Promise.reject(new Error("boom")))).resolves.toBe("error");
  });
});

describe("parseGrantResult — DB 함수 결과 글자", () => {
  test.each([
    ["granted", { kind: "granted" }],
    ["already", { kind: "skipped" }],
    ["pending", { kind: "skipped" }],
    ["voided:self_purchase", { kind: "voided", reason: "self_purchase" }],
    ["voided:inactive", { kind: "voided", reason: "inactive" }],
    ["voided:referrer_cap", { kind: "voided", reason: "referrer_cap" }],
    ["voided:other", { kind: "unknown" }],
    [true, { kind: "unknown" }],
    [null, { kind: "unknown" }],
  ])("%j", (raw, expected) => {
    expect(parseGrantResult(raw)).toEqual(expected);
  });
});

describe("parseCandidateIds — 후보 함수 응답", () => {
  test("숫자 배열(PostgREST setof bigint)과 객체 형태를 모두 받는다", () => {
    expect(parseCandidateIds([3, 7])).toEqual([3, 7]);
    expect(parseCandidateIds([{ referral_reward_candidates: 4 }, { referral_reward_candidates: "9" }])).toEqual([4, 9]);
  });

  test("이상한 값은 버린다", () => {
    expect(parseCandidateIds([0, -1, 1.5, "x", null, {}])).toEqual([]);
    expect(parseCandidateIds(null)).toEqual([]);
    expect(parseCandidateIds({ id: 1 })).toEqual([]);
  });
});

type Parties = { id: number; referrer_user_id: number; invitee_user_id: number };

/** 후보 함수(id 목록), 추천 행(알림 대상), 심사 함수 결과를 돌려주는 DB */
function rewardsDb(opts: {
  candidates: number[];
  parties: Parties[];
  grant?: (referralId: number) => Result;
  fail?: "candidates" | "parties";
}) {
  return fakeSupabase(
    (call) => {
      if (call.table === "referrals") {
        if (opts.fail === "parties") return { data: null, error: { code: "57014", message: "timeout" } };
        const ids = call.in.id ?? [];
        return { data: opts.parties.filter((p) => ids.includes(p.id)), error: null };
      }
      throw new Error(`unexpected table ${call.table}`);
    },
    (params, name) => {
      if (name === "referral_reward_candidates") {
        if (opts.fail === "candidates") return { data: null, error: { code: "57014", message: "timeout" } };
        return { data: opts.candidates.slice(0, params.p_limit as number), error: null };
      }
      if (name === "grant_referral_reward") {
        return opts.grant?.(params.p_referral_id as number) ?? { data: "granted", error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  );
}

const ref = (id: number, referrer: number, invitee: number): Parties => ({
  id,
  referrer_user_id: referrer,
  invitee_user_id: invitee,
});

const grantCalls = (rpc: ReturnType<typeof rewardsDb>["rpc"]) =>
  rpc.mock.calls.filter((c) => c[0] === "grant_referral_reward").map((c) => c[1]);

describe("grantReferralRewards — 후보 선정·판정 모두 DB 함수", () => {
  test("후보 함수가 준 추천을 심사 함수에 넘기고, 지급이면 양쪽에 알린다 — 크레딧 원장은 건드리지 않는다", async () => {
    const { client, calls, rpc } = rewardsDb({ candidates: [5], parties: [ref(5, 2, 9)] });

    const summary = await grantReferralRewards(client, { limit: 5 });

    expect(summary).toEqual({ ...emptyReferralSummary(), checked: 1, granted: 1 });
    expect(rpc).toHaveBeenCalledWith("referral_reward_candidates", { p_limit: 5 });
    expect(grantCalls(rpc)).toEqual([{ p_referral_id: 5 }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.in.id).toEqual([5]);
    expect(calls[0]?.limit).toBe(1);
    expect(calls.every((c) => c.table !== "credits_ledger")).toBe(true);

    const notes = vi.mocked(createNotification).mock.calls.map((c) => c[0]);
    expect(notes.map((n) => n.userId).sort()).toEqual([2, 9]);
    for (const n of notes) {
      expect(n.type).toBe("referral_reward");
      expect(n.title.length).toBeLessThanOrEqual(100);
      expect(n.body.length).toBeLessThanOrEqual(300);
      expect(`${n.title} ${n.body}`).toContain(`신뢰도`);
      expect(`${n.title} ${n.body}`).toContain(String(REFERRAL_TRUST_DELTA));
      expect(`${n.title} ${n.body}`).not.toMatch(/크레딧|기프티콘|포인트|현금|보상금/);
    }
  });

  test("무효는 사유별로 세고 알림은 없다 — 다음 후보는 계속 처리한다", async () => {
    const results: Record<number, string> = {
      1: "voided:self_purchase",
      2: "voided:inactive",
      3: "voided:referrer_cap",
      4: "granted",
    };
    const { client } = rewardsDb({
      candidates: [1, 2, 3, 4],
      parties: [1, 2, 3, 4].map((i) => ref(i, 100 + i, 10 + i)),
      grant: (id) => ({ data: results[id], error: null }),
    });
    const summary = await grantReferralRewards(client, { limit: 5 });
    expect(summary).toEqual({
      checked: 4,
      granted: 1,
      voided: { self_purchase: 1, inactive: 1, referrer_cap: 1 },
      failed: 0,
      remaining: 0,
    });
    expect(settledReferralCount(summary)).toBe(4);
    expect(vi.mocked(createNotification).mock.calls.map((c) => c[0].userId).sort()).toEqual([104, 14]);
  });

  test("already·pending(겹친 실행)은 세지 않고 알림도 없다", async () => {
    const { client } = rewardsDb({
      candidates: [1, 2],
      parties: [ref(1, 2, 9), ref(2, 3, 8)],
      grant: (id) => ({ data: id === 1 ? "already" : "pending", error: null }),
    });
    const summary = await grantReferralRewards(client, { limit: 5 });
    expect(summary).toEqual({ ...emptyReferralSummary(), checked: 2 });
    expect(settledReferralCount(summary)).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  test("심사 함수 오류·알 수 없는 결과는 failed 로 세고 추천 id 로 로그를 남긴다", async () => {
    const { client } = rewardsDb({
      candidates: [5, 6],
      parties: [ref(5, 2, 9), ref(6, 3, 8)],
      grant: (id) =>
        id === 5 ? { data: null, error: { code: "P0001", message: "blocked" } } : { data: "something", error: null },
    });
    expect(await grantReferralRewards(client, { limit: 5 })).toEqual({
      ...emptyReferralSummary(),
      checked: 2,
      failed: 2,
    });
    expect(console.error).toHaveBeenCalledWith("[referrals] grant failed", { referralId: 5, code: "P0001" });
    expect(console.error).toHaveBeenCalledWith("[referrals] unexpected grant result", { referralId: 6 });
  });

  test("후보가 한도만큼 꽉 차면 remaining 1 (더 있을 수 있다), 모자라면 0", async () => {
    const parties = [1, 2, 3, 4].map((i) => ref(i, 100 + i, 10 + i));
    const full = rewardsDb({ candidates: [1, 2, 3, 4], parties });
    expect(await grantReferralRewards(full.client, { limit: 2 })).toEqual({
      ...emptyReferralSummary(),
      checked: 2,
      granted: 2,
      remaining: 1,
    });
    expect(full.rpc).toHaveBeenCalledWith("referral_reward_candidates", { p_limit: 2 });
    expect(grantCalls(full.rpc)).toEqual([{ p_referral_id: 1 }, { p_referral_id: 2 }]);

    const short = rewardsDb({ candidates: [1], parties });
    expect((await grantReferralRewards(short.client, { limit: 2 })).remaining).toBe(0);
  });

  test("한도는 1~50 — 0 이하면 아무것도 부르지 않고, 50 을 넘기면 50", async () => {
    const none = rewardsDb({ candidates: [1], parties: [ref(1, 2, 9)] });
    expect(await grantReferralRewards(none.client, { limit: 0 })).toEqual(emptyReferralSummary());
    expect(none.rpc).not.toHaveBeenCalled();

    const big = rewardsDb({ candidates: [], parties: [] });
    await grantReferralRewards(big.client, { limit: 500 });
    expect(big.rpc).toHaveBeenCalledWith("referral_reward_candidates", { p_limit: 50 });
  });

  test("후보가 없으면 후보 함수 1번으로 끝난다", async () => {
    const { client, calls, rpc } = rewardsDb({ candidates: [], parties: [] });
    expect(await grantReferralRewards(client, { limit: 5 })).toEqual(emptyReferralSummary());
    expect(calls).toHaveLength(0);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  test("사라진 추천(겹친 삭제)은 건너뛴다", async () => {
    const { client, rpc } = rewardsDb({ candidates: [5, 6], parties: [ref(6, 3, 8)] });
    expect(await grantReferralRewards(client, { limit: 5 })).toEqual({
      ...emptyReferralSummary(),
      checked: 1,
      granted: 1,
    });
    expect(grantCalls(rpc)).toEqual([{ p_referral_id: 6 }]);
  });

  test.each(["candidates", "parties"] as const)("%s 조회 실패는 failed 1 + 로그, 심사 없음", async (fail) => {
    const { client, rpc } = rewardsDb({ candidates: [5], parties: [ref(5, 2, 9)], fail });
    expect(await grantReferralRewards(client, { limit: 5 })).toEqual({ ...emptyReferralSummary(), failed: 1 });
    expect(grantCalls(rpc)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("화면 문구의 숫자 = DB 함수의 숫자", () => {
  test("증감 +10, 90일 5건 — 마이그레이션의 상수와 같다", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/20261007000002_referrals.sql"),
      "utf8",
    );
    expect(sql).toContain(`c_delta constant integer := ${REFERRAL_TRUST_DELTA};`);
    expect(sql).toContain(`c_cap constant integer := ${REFERRAL_CAP_PER_WINDOW};`);
    expect(sql).toContain(`c_cap_window constant interval := interval '${REFERRAL_CAP_WINDOW_DAYS} days';`);
  });
});

describe("getReferralStats", () => {
  test("초대 수와 완주 수 (지급된 추천)", async () => {
    const { client, calls } = fakeSupabase((call) => ({
      count: "rewarded_at" in call.not ? 1 : 4,
      error: null,
    }));
    expect(await getReferralStats(client, 2)).toEqual({ invited: 4, completed: 1 });
    expect(calls.every((c) => c.filters.referrer_user_id === 2)).toBe(true);
  });

  test("읽지 못하면 null", async () => {
    const { client } = fakeSupabase(() => ({ error: { code: "57014", message: "timeout" } }));
    expect(await getReferralStats(client, 2)).toBeNull();
  });
});

describe("rankReferrers — 완주까지 간 추천만, 동점은 먼저 닿은 사람", () => {
  const members = new Map([
    [1, { nickname: "가", trust_score: 60 }],
    [2, { nickname: "나", trust_score: 70 }],
    [3, { nickname: "다", trust_score: 80 }],
  ]);

  test("수 내림차순, 같으면 마지막 지급이 이른 사람 먼저, 탈퇴 회원 제외", () => {
    const rows = [
      { referrer_user_id: 1, rewarded_at: "2026-10-01T00:00:00Z" },
      { referrer_user_id: 1, rewarded_at: "2026-10-05T00:00:00Z" },
      { referrer_user_id: 2, rewarded_at: "2026-10-02T00:00:00Z" },
      { referrer_user_id: 2, rewarded_at: "2026-10-03T00:00:00Z" },
      { referrer_user_id: 3, rewarded_at: "2026-10-04T00:00:00Z" },
      { referrer_user_id: 99, rewarded_at: "2026-10-01T00:00:00Z" },
      { referrer_user_id: 99, rewarded_at: "2026-10-01T00:00:00Z" },
      { referrer_user_id: 99, rewarded_at: "2026-10-01T00:00:00Z" },
    ];
    expect(rankReferrers(rows, members, 20)).toEqual([
      { id: 2, nickname: "나", trust_score: 70, count: 2 },
      { id: 1, nickname: "가", trust_score: 60, count: 2 },
      { id: 3, nickname: "다", trust_score: 80, count: 1 },
    ]);
  });

  test("limit 만큼만, 기록이 없으면 빈 목록", () => {
    const rows = [1, 2, 3].map((id) => ({ referrer_user_id: id, rewarded_at: "2026-10-01T00:00:00Z" }));
    expect(rankReferrers(rows, members, 2).map((r) => r.id)).toEqual([1, 2]);
    expect(rankReferrers([], members, 20)).toEqual([]);
  });
});
