import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getMonthlyCompletions,
  kstPreviousMonth,
  pickWinners,
  REWARD_START_MONTH,
} from "@/lib/ranking-rewards";

export const runtime = "edge";

/**
 * GET  /api/admin/ranking-rewards — 지난달(KST) 수상 후보 미리보기 + 지급 여부
 * POST /api/admin/ranking-rewards — 지난달 보상 지급 (멱등)
 *
 * 지급 = ranking_rewards insert → credits_ledger insert → 알림.
 * unique(reward_month, user_id) 가드로 재실행해도 이중지급 없음.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const month = kstPreviousMonth();
  const grantable = month >= REWARD_START_MONTH;

  const completions = await getMonthlyCompletions(supabase, month);
  const winners = pickWinners(completions);

  const { data: granted } = await supabase
    .from("ranking_rewards")
    .select("user_id, rank, amount, completed")
    .eq("reward_month", month);

  return NextResponse.json({
    ok: true,
    month,
    grantable,
    startMonth: REWARD_START_MONTH,
    alreadyGranted: (granted ?? []).length > 0,
    granted: granted ?? [],
    candidates: completions.slice(0, 10),
    winners,
  });
}

export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const month = kstPreviousMonth();

  if (month < REWARD_START_MONTH) {
    return NextResponse.json(
      { ok: false, message: `첫 지급 대상은 ${REWARD_START_MONTH.slice(0, 7)}월분입니다.` },
      { status: 409 },
    );
  }

  const completions = await getMonthlyCompletions(supabase, month);
  const winners = pickWinners(completions);
  if (winners.length === 0) {
    return NextResponse.json({ ok: true, month, granted: 0, message: "지급 대상 없음" });
  }

  let grantedCount = 0;
  const skipped: number[] = [];

  for (const w of winners) {
    // 1) 수상 기록 — unique 위반 = 이미 지급됨 → 스킵 (멱등)
    const { data: reward, error: insErr } = await supabase
      .from("ranking_rewards")
      .insert({
        reward_month: month,
        user_id: w.userId,
        rank: w.rank,
        completed: w.completed,
        amount: w.amount,
        granted_by: admin.id,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !reward) {
      skipped.push(w.userId);
      continue;
    }

    // 2) 크레딧 지급 (append-only ledger)
    const { data: ledger } = await supabase
      .from("credits_ledger")
      .select("amount")
      .eq("user_id", w.userId);
    const balance = (ledger ?? []).reduce((s, r) => s + r.amount, 0);

    const { error: credErr } = await supabase.from("credits_ledger").insert({
      user_id: w.userId,
      amount: w.amount,
      balance_after: balance + w.amount,
      type: "earn",
      ref_type: "ranking_reward",
      ref_id: reward.id,
      description: `${month.slice(0, 7)} 월간 완주 랭킹 ${w.rank}위 보상`,
    });
    if (credErr) {
      // 수상 기록은 남았는데 크레딧 실패 — 수동 복구 필요. 명확히 로깅.
      console.error("[ranking-rewards] ledger insert failed", w.userId, credErr);
      skipped.push(w.userId);
      continue;
    }

    // 3) 알림 (실패 무시)
    await supabase.from("notifications").insert({
      user_id: w.userId,
      type: "reward_granted",
      title: `🏆 ${Number(month.slice(5, 7))}월 완주 랭킹 ${w.rank}위!`,
      body: `축하합니다! 월간 완주 랭킹 ${w.rank}위로 ${w.amount.toLocaleString()} 크레딧이 지급되었습니다.`,
      link: "/credits",
    });

    grantedCount++;
  }

  return NextResponse.json({ ok: true, month, granted: grantedCount, skipped });
}
