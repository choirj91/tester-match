import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getMonthlyCompletions,
  grantMonthlyRewards,
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

  const result = await grantMonthlyRewards(supabase, { month, grantedBy: admin.id });
  return NextResponse.json({ ok: true, ...result });
}
