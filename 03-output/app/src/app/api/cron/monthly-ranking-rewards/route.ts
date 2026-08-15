import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import {
  grantMonthlyRewards,
  kstPreviousMonth,
  REWARD_START_MONTH,
} from "@/lib/ranking-rewards";

export const runtime = "edge";

/**
 * 월간 랭킹 보상 자동 지급 — 매월 1~3일 KST 09:30 실행 (3회 재시도용).
 * 지급 대상: 지난달(KST) 완주 랭킹. 멱등이므로 중복 실행 안전 —
 * 이미 지급된 수상자는 unique 가드로 스킵된다.
 *
 * GitHub Actions: .github/workflows/cron.yml (cron "30 0 1-3 * *")
 * 수동 백업/재실행: /admin/ranking-rewards
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const month = kstPreviousMonth();
  if (month < REWARD_START_MONTH) {
    return NextResponse.json({
      ok: true,
      month,
      granted: 0,
      message: `첫 지급 대상은 ${REWARD_START_MONTH.slice(0, 7)}월분 — 스킵`,
    });
  }

  const supabase = createSupabaseAdminClient();
  const result = await grantMonthlyRewards(supabase, { month, grantedBy: null });

  console.log(
    `[cron/monthly-ranking-rewards] month=${result.month} winners=${result.winners} granted=${result.granted} skipped=${result.skipped.length}`,
  );
  return NextResponse.json({ ok: true, ...result });
}

// GitHub Actions 는 POST 로 호출 — 동일 동작
export const POST = GET;
