import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { PENALTY_TRUST_DELTA, shouldPenalize } from "@/lib/penalty";
import { createNotification } from "@/lib/notifications";

export const runtime = "edge";

/**
 * F-CHK-06 — 미체크인 페널티 sweep.
 *
 * 매칭 active 중 다음에 해당하는 건은 'penalized' 처리:
 *   1. 14일 경과 + 14 미만 체크인 (만료된 미완주)
 *   2. 마지막 체크인 후 5일 이상 연속 미체크인
 *
 * 페널티 결과:
 *   - matches.status = 'penalized'
 *   - users.trust_score 10점 차감 (clamp 0-100)
 *   - trust_score_history INSERT
 *   - apps.required_testers + 1 (정원 복구)
 *
 * Cloudflare Cron 권장: KST 21:00 (UTC 12:00) — 일일 리마인더 1시간 후.
 *   crons += ["0 12 * * *"]
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, app_id, tester_user_id, opted_in_at, checkins(day_n)")
    .eq("status", "active");

  if (error) {
    console.error("[cron/penalty-sweep] query failed", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let penalized = 0;
  for (const m of matches ?? []) {
    if (!m.opted_in_at) continue;
    const checkins = (m.checkins ?? []) as Array<{ day_n: number }>;
    const distinctDays = new Set(checkins.map((c) => c.day_n));
    const distinctCount = distinctDays.size;
    const lastDay = distinctCount === 0 ? 0 : Math.max(...distinctDays);

    if (!shouldPenalize(m.opted_in_at, distinctCount, lastDay)) continue;

    const ok = await applyPenalty(supabase, {
      matchId: m.id,
      appId: m.app_id,
      testerUserId: m.tester_user_id,
    });
    if (ok) penalized++;
  }

  return NextResponse.json({
    ok: true,
    candidates: matches?.length ?? 0,
    penalized,
  });
}

type SB = ReturnType<typeof createSupabaseAdminClient>;

async function applyPenalty(
  supabase: SB,
  args: { matchId: number; appId: number; testerUserId: number },
): Promise<boolean> {
  // 1) matches → penalized
  const { error: matchErr } = await supabase
    .from("matches")
    .update({ status: "penalized" })
    .eq("id", args.matchId)
    .eq("status", "active"); // 동시성 가드
  if (matchErr) {
    console.error("[penalty] match update failed", matchErr);
    return false;
  }

  // 2) trust_score 차감 (admin client → service_role → 트리거 우회)
  const { data: user } = await supabase
    .from("users")
    .select("trust_score")
    .eq("id", args.testerUserId)
    .maybeSingle();
  if (user) {
    const newScore = Math.max(0, Math.min(100, user.trust_score + PENALTY_TRUST_DELTA));
    await supabase
      .from("users")
      .update({ trust_score: newScore })
      .eq("id", args.testerUserId);
    await supabase.from("trust_score_history").insert({
      user_id: args.testerUserId,
      delta: PENALTY_TRUST_DELTA,
      score_after: newScore,
      reason: "penalty.no_checkin",
      ref_type: "match",
      ref_id: args.matchId,
    });
  }

  // 3) 정원 복구 (required_testers +1)
  const { data: app } = await supabase
    .from("apps")
    .select("required_testers, name")
    .eq("id", args.appId)
    .maybeSingle();
  if (app) {
    await supabase
      .from("apps")
      .update({ required_testers: app.required_testers + 1 })
      .eq("id", args.appId);
  }

  // 4) 페널티 인앱 알림
  void createNotification({
    userId: args.testerUserId,
    type: "match_penalized",
    title: "체크인 미완료로 페널티가 적용되었습니다",
    body: `"${app?.name ?? "앱"}" 테스트 체크인 미완료로 신뢰점수가 ${Math.abs(PENALTY_TRUST_DELTA)}점 차감되었습니다.`,
    link: "/my-tests",
  });

  return true;
}
