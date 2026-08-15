import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 월간 랭킹 크레딧 보상 — 정책 단일 소스.
 * 문서: 03-output/policy/ranking-rewards.md
 *
 * 지표는 "당월 14일 완주 수"만 사용한다. 신뢰도·체크인 수는 매치 수에
 * 비례해 인플레하므로 보상 지표로 쓰지 않는다 (동점 처리에만 사용).
 */
export const REWARD_TABLE = [3_000, 2_000, 1_000] as const; // 1~3위
export const REWARD_MONTHLY_BUDGET = REWARD_TABLE.reduce((a, b) => a + b, 0);
/** 첫 집계 대상 월 (이 달 실적부터 보상, 지급은 익월 초) */
export const REWARD_START_MONTH = "2026-09-01";
/** 1위 최소 완주 수 (2·3위는 1 이상) */
export const RANK1_MIN_COMPLETED = 2;
/** 수상 자격 최소 신뢰도 */
export const MIN_TRUST = 50;

export type MonthlyCompletion = {
  userId: number;
  nickname: string;
  trustScore: number;
  completed: number;
  /** 당월 마지막 완주 확정 시각 — 동점 시 먼저 달성한 쪽 우선 */
  lastCompletedAt: string;
};

/** KST 기준 해당 월의 [시작, 다음 달 시작) UTC ISO 경계 */
export function kstMonthRange(monthFirstDay: string): { fromIso: string; toIso: string } {
  const [y, m] = monthFirstDay.split("-").map(Number);
  const from = new Date(`${monthFirstDay}T00:00:00+09:00`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const to = new Date(`${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+09:00`);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/** KST 기준 현재 달의 1일 (YYYY-MM-01) */
export function kstCurrentMonth(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 7)}-01`;
}

/** KST 기준 지난달 1일 */
export function kstPreviousMonth(): string {
  const [y, m] = kstCurrentMonth().split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}-01`;
}

/**
 * 당월 완주 집계 — 완주 확정 = day_n=14 체크인의 checked_in_at 이 당월(KST).
 * 자기 소유 앱 완주(부계정 의심)와 신뢰도 미달·탈퇴 계정은 제외.
 * 정렬: 완주 수 → 신뢰도 → 먼저 달성.
 */
export async function getMonthlyCompletions(
  supabase: SupabaseClient,
  monthFirstDay: string,
): Promise<MonthlyCompletion[]> {
  const { fromIso, toIso } = kstMonthRange(monthFirstDay);

  const { data: rows } = await supabase
    .from("checkins")
    .select(
      "checked_in_at, matches!inner(status, tester_user_id, apps!inner(owner_user_id))",
    )
    .eq("day_n", 14)
    .eq("matches.status", "completed")
    .gte("checked_in_at", fromIso)
    .lt("checked_in_at", toIso)
    .limit(2000);

  type Row = {
    checked_in_at: string;
    matches: { status: string; tester_user_id: number; apps: { owner_user_id: number } };
  };

  const byUser = new Map<number, { completed: number; lastCompletedAt: string }>();
  for (const raw of (rows ?? []) as unknown as Row[]) {
    const m = Array.isArray(raw.matches) ? raw.matches[0] : raw.matches;
    const app = Array.isArray(m.apps) ? m.apps[0] : m.apps;
    if (app.owner_user_id === m.tester_user_id) continue; // 자기 앱 제외
    const cur = byUser.get(m.tester_user_id);
    byUser.set(m.tester_user_id, {
      completed: (cur?.completed ?? 0) + 1,
      lastCompletedAt:
        cur && cur.lastCompletedAt > raw.checked_in_at
          ? cur.lastCompletedAt
          : raw.checked_in_at,
    });
  }

  if (byUser.size === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, nickname, trust_score, deleted_at")
    .in("id", [...byUser.keys()]);

  const result: MonthlyCompletion[] = [];
  for (const u of users ?? []) {
    if (u.deleted_at) continue;
    if (u.trust_score < MIN_TRUST) continue;
    const agg = byUser.get(u.id);
    if (!agg) continue;
    result.push({
      userId: u.id,
      nickname: u.nickname,
      trustScore: u.trust_score,
      completed: agg.completed,
      lastCompletedAt: agg.lastCompletedAt,
    });
  }

  return result.sort(
    (a, b) =>
      b.completed - a.completed ||
      b.trustScore - a.trustScore ||
      a.lastCompletedAt.localeCompare(b.lastCompletedAt),
  );
}

/**
 * 순위·자격 적용 → 지급 대상 (rank, amount 포함).
 * 1위 요건(완주 ≥ RANK1_MIN_COMPLETED) 미달이면 1위는 공석 —
 * 최상위자가 2위 보상을 받는다 (요건 완화 아님).
 */
export function pickWinners(rows: MonthlyCompletion[]) {
  const winners: Array<MonthlyCompletion & { rank: number; amount: number }> = [];
  let slot = 1;
  let i = 0;
  while (slot <= REWARD_TABLE.length && i < rows.length) {
    const r = rows[i];
    if (slot === 1 && r.completed < RANK1_MIN_COMPLETED) {
      slot = 2; // 1위 공석
      continue;
    }
    winners.push({ ...r, rank: slot, amount: REWARD_TABLE[slot - 1] });
    slot++;
    i++;
  }
  return winners;
}
