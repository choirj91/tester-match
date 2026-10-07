/**
 * 친구 추천 → 신뢰도 보너스 (ADR-0019) — 서버 전용. 쿠키·순위 헬퍼는 순수 함수.
 *
 * 링크 /r/{회원 id} → 방문자에게 추천 쿠키(30일, 마지막으로 연 링크 기준)
 * → 가입 직후(Google 로그인 콜백·이메일 가입 확인) 새 회원이면 referrals 기록
 * → 6시간 보상 크론이 피추천인의 확정(released) 유료 시트가 생긴 추천을 골라 grant_referral_reward 호출.
 *   지급 여부는 DB 함수가 정한다 (자기 결제·탈퇴/정지·추천인 90일 5건 상한이면 무효로 끝냄, 아니면 양쪽 +10).
 * 크레딧은 없다 — credits_ledger 를 건드리지 않고, 문구에 크레딧·기프티콘·포인트·현금을 쓰지 않는다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetch-all";
import { createNotification } from "@/lib/notifications";
import { REFERRAL_TRUST_DELTA } from "@/lib/trust";

export { REFERRAL_TRUST_DELTA };

/**
 * __Host- 접두사: Secure + Path=/ + Domain 없음일 때만 브라우저가 받아 주므로 다른 서브도메인이 덮어써
 * 추천인을 바꿔치기할 수 없다 (가입 확인 쿠키 CONFIRM_COOKIE 와 같은 처리 — 개발 서버 localhost 도 Secure 를 받는다).
 */
export const REFERRAL_COOKIE = "__Host-tm_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** 추천으로 기록하는 회원 — 회원 행이 이 시간 안에 만들어진 새 회원만. 기존 회원의 재로그인은 제외 */
export const REFERRAL_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 서버 간 시계 차이 여유 — 회원 행 생성 시각이 "미래"로 보여도 이만큼은 새 회원으로 본다 */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
/** 링크를 연 사람이 도착하는 곳 — 서비스 소개가 있는 첫 화면 */
export const REFERRAL_LANDING_PATH = "/";

/** 회원 id — 0 으로 시작하지 않는 숫자만. 16자리까지 받고 안전 정수인지 다시 본다 */
const REFERRAL_CODE_PATTERN = /^[1-9]\d{0,15}$/;

export function parseReferralCode(value: unknown): number | null {
  if (typeof value !== "string" || !REFERRAL_CODE_PATTERN.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function referralLink(siteUrl: string, userId: number): string {
  return `${siteUrl}/r/${userId}`;
}

/** Cookie 헤더에서 추천 쿠키 원문. 값이 잘못돼도 돌려준다 — 있으면 지워야 하므로 */
export function readReferralCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === REFERRAL_COOKIE) return rest.join("=");
  }
  return null;
}

export type ReferralCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: true;
  path: "/";
  maxAge: number;
};

/**
 * Lax: Google 로그인 콜백·인증 메일 링크는 다른 사이트에서 오는 최상위 이동이라 Strict 면 쿠키가 실리지 않는다.
 * Secure·Path=/ 는 __Host- 접두사의 조건이라 환경과 무관하게 고정한다.
 */
export function referralCookieOptions(maxAge = REFERRAL_COOKIE_MAX_AGE_SECONDS): ReferralCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge };
}

/** 회원 행이 추천으로 기록할 수 있을 만큼 새것인지. 시각을 읽을 수 없으면 아니다 */
export function isWithinAttributionWindow(memberCreatedAt: string, now: number): boolean {
  const created = Date.parse(memberCreatedAt);
  if (Number.isNaN(created)) return false;
  const age = now - created;
  return age >= -CLOCK_SKEW_MS && age <= REFERRAL_ATTRIBUTION_WINDOW_MS;
}

export type RecordReferralOutcome =
  | "recorded"
  | "already_referred"
  | "self"
  | "referrer_ineligible"
  | "invitee_not_new"
  | "no_member"
  | "error"
  /** 로그인 경로의 시간 상한을 넘김 (withAttributionTimeout) */
  | "timeout";

/**
 * 추천 쿠키를 지워도 되는 결과인지. 일시 실패(error·timeout)·회원 행 없음(no_member)이면 남겨 두어
 * 다음 로그인에서 다시 시도한다 — 새 회원 판정(24시간)이 그대로 걸리므로 늦게 기록될 위험은 없다.
 */
export function isReferralSettled(outcome: RecordReferralOutcome): boolean {
  return outcome !== "error" && outcome !== "no_member" && outcome !== "timeout";
}

/** 로그인·가입 확인 경로에서 추천 기록에 쓰는 시간 상한 — 추천 때문에 로그인이 늘어지지 않게 */
export const REFERRAL_ATTRIBUTION_TIMEOUT_MS = 2000;

/**
 * 추천 기록을 시간 상한 안에서 기다린다. 넘기면 "timeout" — 호출측은 쿠키를 남기고 로그인을 이어간다.
 * 넘긴 뒤에도 기록 요청 자체는 끝까지 돌 수 있다. 늦게 기록돼도 다음 로그인에서 already_referred 로 정리된다.
 * 실패를 던지지 않는다.
 */
export async function withAttributionTimeout(
  work: Promise<RecordReferralOutcome>,
  ms: number = REFERRAL_ATTRIBUTION_TIMEOUT_MS,
): Promise<RecordReferralOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<RecordReferralOutcome>((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  const guarded = work.catch((err: unknown): RecordReferralOutcome => {
    console.error("[referrals] attribution failed", err instanceof Error ? err.message : "unknown");
    return "error";
  });
  try {
    const outcome = await Promise.race([guarded, timeout]);
    if (outcome === "timeout") console.error("[referrals] attribution timed out", { ms });
    return outcome;
  } finally {
    clearTimeout(timer);
  }
}

type MemberRow = { id: number; status: string; deleted_at: string | null; created_at: string };

/**
 * 추천 관계 기록. 자기 자신, 없는·탈퇴·정지 추천인, 24시간보다 오래된 회원은 기록하지 않는다.
 * 피추천인은 한 번만 (invitee unique — 겹친 요청의 unique 위반은 이미 기록된 것으로 본다).
 */
export async function recordReferral(
  supabase: SupabaseClient,
  args: { inviteeUserId: number; referrerUserId: number; now?: number },
): Promise<RecordReferralOutcome> {
  if (args.inviteeUserId === args.referrerUserId) return "self";

  const { data, error } = await supabase
    .from("users")
    .select("id, status, deleted_at, created_at")
    .in("id", [args.inviteeUserId, args.referrerUserId]);
  if (error) {
    console.error("[referrals] member lookup failed", error.code ?? error.message);
    return "error";
  }
  const rows = (data ?? []) as MemberRow[];
  const referrer = rows.find((r) => r.id === args.referrerUserId);
  const invitee = rows.find((r) => r.id === args.inviteeUserId);
  if (!referrer || referrer.status !== "active" || referrer.deleted_at !== null) {
    return "referrer_ineligible";
  }
  if (
    !invitee ||
    invitee.deleted_at !== null ||
    !isWithinAttributionWindow(invitee.created_at, args.now ?? Date.now())
  ) {
    return "invitee_not_new";
  }

  const { error: insertError } = await supabase.from("referrals").insert({
    referrer_user_id: args.referrerUserId,
    invitee_user_id: args.inviteeUserId,
  });
  if (insertError) {
    if (insertError.code === "23505") return "already_referred";
    console.error("[referrals] insert failed", insertError.code ?? insertError.message);
    return "error";
  }
  return "recorded";
}

/**
 * 로그인·가입 확정 직후 호출 — 그 로그인의 회원 행을 피추천인으로 기록한다.
 * 어떤 실패도 던지지 않는다 (추천 때문에 로그인이 막히면 안 된다).
 */
export async function recordReferralForLogin(
  supabase: SupabaseClient,
  args: { authUserId: string; referrerUserId: number },
): Promise<RecordReferralOutcome> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", args.authUserId)
      .maybeSingle<{ id: number }>();
    if (error) {
      console.error("[referrals] login member lookup failed", error.code ?? error.message);
      return "error";
    }
    if (!data) return "no_member";
    return await recordReferral(supabase, {
      inviteeUserId: data.id,
      referrerUserId: args.referrerUserId,
    });
  } catch (err) {
    console.error("[referrals] attribution failed", err instanceof Error ? err.message : "unknown");
    return "error";
  }
}

// ── 지급 (6시간 보상 크론) ─────────────────────────────────────────────

/** DB 후보 함수(referral_reward_candidates)가 한 번에 돌려주는 최대 건수 — 함수 안에서도 1~50 으로 자른다 */
export const REFERRAL_CANDIDATE_MAX = 50;

/** 추천인 90일 지급 상한 — 판정은 DB 함수(grant_referral_reward)가 한다. 이 값은 화면 문구용 */
export const REFERRAL_CAP_PER_WINDOW = 5;
export const REFERRAL_CAP_WINDOW_DAYS = 90;

export const REFERRAL_VOID_REASONS = ["self_purchase", "inactive", "referrer_cap"] as const;
export type ReferralVoidReason = (typeof REFERRAL_VOID_REASONS)[number];

export type ReferralGrantResult =
  | { kind: "granted" }
  | { kind: "voided"; reason: ReferralVoidReason }
  /** already(이미 끝남) · pending(확정 시트가 사라짐 — 겹친 실행) */
  | { kind: "skipped" }
  | { kind: "unknown" };

/** grant_referral_reward 의 결과 글자를 해석한다 */
export function parseGrantResult(raw: unknown): ReferralGrantResult {
  if (raw === "granted") return { kind: "granted" };
  if (raw === "already" || raw === "pending") return { kind: "skipped" };
  if (typeof raw === "string" && raw.startsWith("voided:")) {
    const reason = raw.slice("voided:".length);
    if ((REFERRAL_VOID_REASONS as readonly string[]).includes(reason)) {
      return { kind: "voided", reason: reason as ReferralVoidReason };
    }
  }
  return { kind: "unknown" };
}

export type ReferralGrantSummary = {
  /** DB 후보 함수가 돌려준 후보 수 (대기 + 피추천인 확정 시트 있음) */
  checked: number;
  granted: number;
  voided: Record<ReferralVoidReason, number>;
  failed: number;
  /** 후보가 한도만큼 꽉 찼으면 1 — 더 있을 수 있다 (크론이 다시 부른다) */
  remaining: number;
};

export function emptyReferralSummary(): ReferralGrantSummary {
  return {
    checked: 0,
    granted: 0,
    voided: { self_purchase: 0, inactive: 0, referrer_cap: 0 },
    failed: 0,
    remaining: 0,
  };
}

/** 이번 호출에서 지급·무효로 끝낸 추천 수 — 크론이 반복(more) 여부를 정할 때 진전으로 본다 */
export function settledReferralCount(summary: ReferralGrantSummary): number {
  return summary.granted + Object.values(summary.voided).reduce((sum, n) => sum + n, 0);
}

type ReferralParties = { id: number; referrer_user_id: number; invitee_user_id: number };

/** 후보 함수 응답 → 추천 id 목록. PostgREST 는 setof bigint 를 숫자 배열로 준다 (객체 형태도 받아 둔다) */
export function parseCandidateIds(data: unknown): number[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const raw =
      item !== null && typeof item === "object"
        ? (item as Record<string, unknown>).referral_reward_candidates
        : item;
    const id = typeof raw === "string" ? Number(raw) : raw;
    return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? [id] : [];
  });
}

/**
 * 심사 후보와 그 추천의 두 회원 — 쿼리 2번 (후보 함수, 알림 대상 조회).
 * 후보 선정은 DB 함수가 한다: 대기 추천 중 피추천인에게 확정 시트가 있는 것만 id 순으로.
 * 유료 시트를 하지 않는 피추천인이 아무리 쌓여도 그 뒤의 추천을 가리지 않는다.
 */
async function findCandidates(supabase: SupabaseClient, limit: number): Promise<ReferralParties[] | null> {
  const { data, error } = await supabase.rpc("referral_reward_candidates", { p_limit: limit });
  if (error) {
    console.error("[referrals] candidate lookup failed", error.code ?? error.message);
    return null;
  }
  const ids = parseCandidateIds(data);
  if (ids.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase
    .from("referrals")
    .select("id, referrer_user_id, invitee_user_id")
    .in("id", ids)
    .limit(ids.length);
  if (rowsError) {
    console.error("[referrals] candidate parties lookup failed", rowsError.code ?? rowsError.message);
    return null;
  }
  const byId = new Map(((rows ?? []) as ReferralParties[]).map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
}

const REFERRER_NOTICE = {
  title: `추천한 친구가 첫 유료 테스트를 완주했습니다 — 신뢰도 +${REFERRAL_TRUST_DELTA}`,
  body: `초대한 친구가 첫 유료 테스트(급구 시트)를 14일 완주했습니다. 나와 친구 모두 신뢰도가 ${REFERRAL_TRUST_DELTA}점 올랐습니다.`,
} as const;

const INVITEE_NOTICE = {
  title: `첫 유료 테스트 완주 — 추천해 준 친구와 함께 신뢰도 +${REFERRAL_TRUST_DELTA}`,
  body: `추천 링크로 가입해 첫 유료 테스트(급구 시트)를 14일 완주했습니다. 추천해 준 친구와 함께 신뢰도가 ${REFERRAL_TRUST_DELTA}점 올랐습니다.`,
} as const;

/**
 * 확정 시트가 생긴 대기 추천을 DB 함수로 심사·지급한다 (한 번에 limit 건, 최대 50).
 * 지급(granted)일 때만 양쪽에 알린다. 무효는 최종 상태라 다음 실행의 후보에서 빠진다 — 막힌 건이 자리를 차지하지 않는다.
 */
export async function grantReferralRewards(
  supabase: SupabaseClient,
  args: { limit: number },
): Promise<ReferralGrantSummary> {
  const limit = Math.min(Math.floor(args.limit), REFERRAL_CANDIDATE_MAX);
  if (!(limit > 0)) return emptyReferralSummary();
  const candidates = await findCandidates(supabase, limit);
  // 대상 조회 실패도 실패 1건으로 센다 — 크론 응답에서 0건 지급과 구분되게
  if (candidates === null) return { ...emptyReferralSummary(), failed: 1 };

  let summary: ReferralGrantSummary = {
    ...emptyReferralSummary(),
    checked: candidates.length,
    remaining: candidates.length >= limit ? 1 : 0,
  };
  for (const r of candidates) {
    const { data, error } = await supabase.rpc("grant_referral_reward", { p_referral_id: r.id });
    if (error) {
      summary = { ...summary, failed: summary.failed + 1 };
      console.error("[referrals] grant failed", { referralId: r.id, code: error.code ?? error.message });
      continue;
    }
    const result = parseGrantResult(data);
    if (result.kind === "unknown") {
      summary = { ...summary, failed: summary.failed + 1 };
      console.error("[referrals] unexpected grant result", { referralId: r.id });
    } else if (result.kind === "voided") {
      summary = {
        ...summary,
        voided: { ...summary.voided, [result.reason]: summary.voided[result.reason] + 1 },
      };
    } else if (result.kind === "granted") {
      summary = { ...summary, granted: summary.granted + 1 };
      await Promise.all([
        createNotification({ userId: r.referrer_user_id, type: "referral_reward", link: "/profile", ...REFERRER_NOTICE }),
        createNotification({ userId: r.invitee_user_id, type: "referral_reward", link: "/profile", ...INVITEE_NOTICE }),
      ]);
    }
  }
  return summary;
}

// ── 화면 (프로필 카드·추천 랭킹) ───────────────────────────────────────

export type ReferralStats = { invited: number; completed: number };

/** 내가 초대한 수와 그중 첫 유료 테스트를 완주한 수. 읽지 못하면 null */
export async function getReferralStats(
  supabase: SupabaseClient,
  userId: number,
): Promise<ReferralStats | null> {
  const [invited, completed] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", userId),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", userId)
      .not("rewarded_at", "is", null),
  ]);
  const error = invited.error ?? completed.error;
  if (error) {
    console.error("[referrals] stats lookup failed", error.code ?? error.message);
    return null;
  }
  return { invited: invited.count ?? 0, completed: completed.count ?? 0 };
}

export type RewardedReferral = { referrer_user_id: number; rewarded_at: string };

/** 지급까지 간 추천 전부 — 가입만 한 추천은 순위에 넣지 않는다 (가입은 공짜로 늘릴 수 있다) */
export async function fetchRewardedReferrals(supabase: SupabaseClient): Promise<RewardedReferral[]> {
  return fetchAll<RewardedReferral>((from, to) =>
    supabase
      .from("referrals")
      .select("referrer_user_id, rewarded_at")
      .not("rewarded_at", "is", null)
      .order("id")
      .range(from, to),
  );
}

export type RankedReferrer = { id: number; nickname: string; trust_score: number; count: number };

/**
 * 추천 랭킹: 완주까지 간 추천 수 내림차순, 같으면 마지막 지급이 이른 사람(먼저 그 수에 닿은 사람) 먼저.
 * members 에 없는 회원(탈퇴 등)은 뺀다.
 */
export function rankReferrers(
  rewarded: ReadonlyArray<RewardedReferral>,
  members: ReadonlyMap<number, { nickname: string; trust_score: number }>,
  limit: number,
): RankedReferrer[] {
  const tally = new Map<number, { count: number; latest: number }>();
  for (const r of rewarded) {
    const at = Date.parse(r.rewarded_at);
    const prev = tally.get(r.referrer_user_id) ?? { count: 0, latest: Number.NEGATIVE_INFINITY };
    tally.set(r.referrer_user_id, {
      count: prev.count + 1,
      latest: Number.isNaN(at) ? prev.latest : Math.max(prev.latest, at),
    });
  }
  return [...tally.entries()]
    .flatMap(([id, t]) => {
      const m = members.get(id);
      return m ? [{ id, nickname: m.nickname, trust_score: m.trust_score, count: t.count, latest: t.latest }] : [];
    })
    .sort((a, b) => b.count - a.count || a.latest - b.latest || a.id - b.id)
    .slice(0, limit)
    .map(({ id, nickname, trust_score, count }) => ({ id, nickname, trust_score, count }));
}
