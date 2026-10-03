import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  grantLaunchBonuses,
  releaseDueRewards,
  repairMissingHolds,
  repairReleasedWithoutEarn,
} from "@/lib/seat-rewards";

export const runtime = "edge";

const RELEASES_PER_CALL = 5;
const HOLD_REPAIRS_PER_CALL = 2;
const EARN_REPAIRS_PER_CALL = 5;
const LAUNCH_BONUSES_PER_CALL = 6;

/**
 * 유료 시트 보상 크론 (6시간 간격) — ADR-0012 부록 A·C.
 *   1. 구매자 3일 무응답 보류 → 자동 확정, 이의 7일 미판정 → 자동 지급
 *   2. 보정: 보류 누락 생성, released 인데 적립 누락 채움
 *   3. 출시 보너스: 앱이 "출시 완료"가 된 시트 테스터에게 +100
 * 요청당 처리량에 상한이 있어 응답의 more 가 true 면 다시 호출한다 (워크플로우가 반복). 전부 멱등.
 * 진전이 없으면 more 를 내지 않는다 — 막힌 건 하나 때문에 무한 반복하지 않는다.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  const supabase = createSupabaseAdminClient();

  const due = await releaseDueRewards(supabase, RELEASES_PER_CALL);
  if (due.released > 0) {
    // 보정·출시 보너스는 다음 호출에서 — 한 요청에 지급과 보정을 같이 넣지 않는다
    return NextResponse.json({ ok: true, released: due.released, more: true });
  }

  const repairedHolds = await repairMissingHolds(supabase, HOLD_REPAIRS_PER_CALL);
  const repairedEarn = await repairReleasedWithoutEarn(supabase, EARN_REPAIRS_PER_CALL);
  const launch = await grantLaunchBonuses(supabase, LAUNCH_BONUSES_PER_CALL);
  return NextResponse.json({
    ok: true,
    released: 0,
    stuckDue: due.remaining,
    repairedHolds,
    repairedEarn,
    launchGranted: launch.granted,
    more:
      repairedHolds === HOLD_REPAIRS_PER_CALL ||
      repairedEarn === EARN_REPAIRS_PER_CALL ||
      (launch.granted > 0 && launch.remaining > 0),
  });
}

export const POST = GET;
