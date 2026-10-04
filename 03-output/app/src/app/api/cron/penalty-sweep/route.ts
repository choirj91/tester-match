import { NextResponse } from "next/server";
import { releasePaidSeat } from "@/lib/paid-seats";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { PENALTY_TRUST_DELTA } from "@/lib/penalty";
import { judgeMatch, type SweepCheckin } from "@/lib/penalty-judge";
import { createNotification } from "@/lib/notifications";
import { completePaidSeat } from "@/lib/seat-rewards";
import { TRUST_MAX } from "@/lib/trust";

/**
 * 요청당 서브리퀘스트 상한(50) 안에서 처리할 예산. 건별 예상 비용은 lib/penalty-judge.ts.
 * 상한을 넘으면 매칭은 이미 penalized 인데 시트 해제·환불이 빠진 채 끝난다 → 넘기 전에 멈추고 다음 호출로 미룬다.
 */
const SUBREQUEST_BUDGET = 44;

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
 * 일정: GitHub Actions 스케줄 "0 12 * * *" (KST 21:00 예약, 실제 실행은 수 시간 늦음) — 일일 리마인더(KST 16:00 예약) 뒤.
 *   crons += ["0 12 * * *"]
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, app_id, tester_user_id, opted_in_at, paid_order_id, checkins(day_n, screenshot_url)")
    .eq("status", "active");

  if (error) {
    console.error("[cron/penalty-sweep] query failed", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let penalized = 0;
  let seatsCompleted = 0;
  let deferred = 0;
  let budget = SUBREQUEST_BUDGET;
  for (const m of matches ?? []) {
    if (!m.opted_in_at) continue;
    const { verdict, cost, distinctCount } = judgeMatch({
      optedInAt: m.opted_in_at,
      isPaidSeat: m.paid_order_id != null,
      checkins: (m.checkins ?? []) as SweepCheckin[],
    });
    if (verdict === "ok") continue;

    if (cost > budget) {
      deferred++;
      continue;
    }
    budget -= cost;

    if (verdict === "complete" && m.paid_order_id != null) {
      const done = await completePaidSeat(supabase, {
        matchId: m.id,
        orderId: m.paid_order_id,
        testerUserId: m.tester_user_id,
      });
      if (done.completed) seatsCompleted++;
      continue;
    }

    const ok = await applyPenalty(supabase, {
      matchId: m.id,
      appId: m.app_id,
      testerUserId: m.tester_user_id,
      noShow: m.paid_order_id != null && distinctCount === 0,
    });
    if (ok) penalized++;
  }

  return NextResponse.json({
    ok: true,
    candidates: matches?.length ?? 0,
    penalized,
    seatsCompleted,
    deferred,
    // 미룬 건이 있고 이번 호출에 진전이 있었을 때만 다시 부르게 한다 (막힌 건으로 무한 반복 방지)
    more: deferred > 0 && penalized + seatsCompleted > 0,
  });
}

type SB = ReturnType<typeof createSupabaseAdminClient>;

async function applyPenalty(
  supabase: SB,
  args: { matchId: number; appId: number; testerUserId: number; noShow?: boolean },
): Promise<boolean> {
  // 1) matches → penalized
  const { data: movedRows, error: matchErr } = await supabase
    .from("matches")
    .update({ status: "penalized" })
    .eq("id", args.matchId)
    .eq("status", "active") // 동시성 가드
    .select("id");
  if (matchErr) {
    console.error("[penalty] match update failed", matchErr);
    return false;
  }
  // 스윕이 읽은 뒤 완주·옵트아웃된 매칭이면 아무것도 하지 않는다 (환불·증빙 삭제 오작동 방지)
  if (!movedRows || movedRows.length === 0) return false;

  // 2) trust_score 차감 (admin client → service_role → 트리거 우회)
  const { data: user } = await supabase
    .from("users")
    .select("trust_score")
    .eq("id", args.testerUserId)
    .maybeSingle();
  // 유료 시트 무참여(체크인 0회) 해제는 설치 불가 등 테스터 책임이 아닐 수 있어 신뢰도를 깎지 않는다
  if (user && !args.noShow) {
    const newScore = Math.max(0, Math.min(TRUST_MAX, user.trust_score + PENALTY_TRUST_DELTA));
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

  // 3) 유료 시트면 슬롯·증빙 해제, 무료면 정원 복구 (required_testers +1)
  const wasPaidSeat = await releasePaidSeat(supabase, args.matchId);
  const { data: app } = await supabase
    .from("apps")
    .select("required_testers, name")
    .eq("id", args.appId)
    .maybeSingle();
  if (app && !wasPaidSeat) {
    await supabase
      .from("apps")
      .update({ required_testers: app.required_testers + 1 })
      .eq("id", args.appId);
  }

  // 4) 페널티 인앱 알림
  void createNotification({
    userId: args.testerUserId,
    type: "match_penalized",
    title: args.noShow ? "유료 시트가 해제되었습니다" : "체크인 미완료로 페널티가 적용되었습니다",
    body: args.noShow
      ? `"${app?.name ?? "앱"}" 유료 시트에서 3일차까지 체크인이 없어 시트가 해제되었습니다. 신뢰도 차감은 없습니다.`
      : `"${app?.name ?? "앱"}" 테스트 체크인 미완료로 신뢰점수가 ${Math.abs(PENALTY_TRUST_DELTA)}점 차감되었습니다.`,
    link: "/my-tests",
  });

  return true;
}

export const POST = GET;
