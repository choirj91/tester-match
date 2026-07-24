import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 신뢰도(Trust Score) 정책 상수 — 단일 소스.
 * 정책 문서: 03-output/policy/trust-score.md · 결정: ADR-0010 (v1.1)
 *
 * 원칙: 가점은 "체크인 실행"에만, 감점은 "이탈"에만. 앱 등록·게시글 등
 * 어뷰징 가능한 행위에는 점수를 연결하지 않는다.
 */
export const TRUST_START = 50;
export const TRUST_MIN = 0;
export const TRUST_MAX = 1000;

/** 일일 체크인 1회 — UNIQUE(match_id, day_n) 가드로 하루 1회만 발생 */
export const CHECKIN_TRUST_DELTA = +1;
/** 자진 중도 포기 (옵트아웃) — 사전 고지된 소액 감점 */
export const OPTOUT_TRUST_DELTA = -3;
/** 무단 이탈 (기간 만료 미완주 또는 5일 연속 미체크인) */
export const PENALTY_TRUST_DELTA = -10;

export type TrustReason =
  | "reward.checkin"
  | "penalty.opt_out"
  | "penalty.no_checkin"
  | "admin.adjust";

/**
 * 신뢰도 증감 적용 — users.trust_score 갱신(0~100 clamp) + trust_score_history 기록.
 * admin client(service_role) 필요 (users 보호 트리거 우회).
 * 실패해도 호출측 흐름을 깨지 않도록 오류는 로깅만 한다.
 */
export async function applyTrustDelta(
  supabase: SupabaseClient,
  args: {
    userId: number;
    delta: number;
    reason: TrustReason;
    refType?: "match" | "app" | "admin";
    refId?: number;
  },
): Promise<number | null> {
  const { data: user, error: selErr } = await supabase
    .from("users")
    .select("trust_score")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr || !user) {
    console.error("[trust] user lookup failed", args.userId, selErr);
    return null;
  }

  const newScore = Math.max(TRUST_MIN, Math.min(TRUST_MAX, user.trust_score + args.delta));

  const { error: updErr } = await supabase
    .from("users")
    .update({ trust_score: newScore })
    .eq("id", args.userId);
  if (updErr) {
    console.error("[trust] score update failed", args.userId, updErr);
    return null;
  }

  const { error: histErr } = await supabase.from("trust_score_history").insert({
    user_id: args.userId,
    delta: args.delta,
    score_after: newScore,
    reason: args.reason,
    ref_type: args.refType ?? null,
    ref_id: args.refId ?? null,
  });
  if (histErr) {
    console.error("[trust] history insert failed", args.userId, histErr);
  }

  return newScore;
}
