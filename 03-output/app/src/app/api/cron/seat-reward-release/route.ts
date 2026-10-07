import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emptyReferralSummary, grantReferralRewards, settledReferralCount } from "@/lib/referrals";
import {
  grantLaunchBonuses,
  releaseDueRewards,
  repairMissingHolds,
  repairReleasedWithoutEarn,
} from "@/lib/seat-rewards";

const RELEASES_PER_CALL = 5;
const HOLD_REPAIRS_PER_CALL = 2;
const EARN_REPAIRS_PER_CALL = 5;
const LAUNCH_BONUSES_PER_CALL = 4;
/** 추천 보너스 1건 = 심사·지급 함수 1 + (지급이면) 알림 2 서브리퀘스트. 후보 조회는 2 (후보 함수, 알림 대상) */
const REFERRAL_REWARDS_PER_CALL = 5;
/** 지급 시도가 전부 실패해 서브리퀘스트를 이미 쓴 호출에서의 보정 한도 */
const STRAINED_HOLD_REPAIRS = 1;
const STRAINED_EARN_REPAIRS = 2;

/**
 * 유료 시트 보상 크론 (6시간 간격) — ADR-0012 부록 A·C.
 *   1. 구매자 3일 무응답 보류 → 자동 확정, 이의 7일 미판정 → 자동 지급
 *   2. 보정: 보류 누락 생성, released 인데 적립 누락 채움
 *   3. 출시 보너스: 앱이 "출시 완료"가 된 시트 테스터에게 +100
 *   4. 친구 추천: 피추천인의 첫 시트가 확정되면 DB 함수가 심사 — 지급(양쪽 신뢰도 +10) 또는 무효 (ADR-0019, 크레딧 없음)
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
    // 보정·출시 보너스는 다음 호출에서 — 한 요청에 지급과 보정을 같이 넣지 않는다 (서브리퀘스트 상한)
    return NextResponse.json({
      ok: true,
      released: due.released,
      failed: due.attempted - due.released,
      more: true,
    });
  }

  // 지급할 것이 없거나 시도가 전부 실패한 호출. 실패한 시도가 서브리퀘스트를 이미 썼으면 보정 폭을 줄이고
  // 출시 보너스는 건너뛴다 — 막힌 지급 건이 보정까지 굶기지 않게 하되 요청당 상한은 넘지 않는다.
  const strained = due.attempted > 0;
  const repairedHolds = await repairMissingHolds(
    supabase,
    strained ? STRAINED_HOLD_REPAIRS : HOLD_REPAIRS_PER_CALL,
  );
  const repairedEarn = await repairReleasedWithoutEarn(
    supabase,
    strained ? STRAINED_EARN_REPAIRS : EARN_REPAIRS_PER_CALL,
  );
  const launch = strained
    ? { granted: 0, remaining: 0 }
    : await grantLaunchBonuses(supabase, LAUNCH_BONUSES_PER_CALL);
  // 추천 보너스도 출시 보너스처럼 지급 시도가 막힌 호출에서는 건너뛴다 — 확정된 시트는 남으니 다음 호출이 잇는다
  const referral = strained
    ? emptyReferralSummary()
    : await grantReferralRewards(supabase, { limit: REFERRAL_REWARDS_PER_CALL });
  return NextResponse.json({
    ok: true,
    released: 0,
    failedDue: due.attempted,
    stuckDue: due.remaining,
    repairedHolds,
    repairedEarn,
    launchGranted: launch.granted,
    referral,
    // 지급 시도가 전부 실패한 호출은 반복하지 않는다 (같은 건을 다시 잡을 뿐) — 리포트의 "자동 확정 지연" 경보로 드러난다
    more:
      !strained &&
      (repairedHolds === HOLD_REPAIRS_PER_CALL ||
        repairedEarn === EARN_REPAIRS_PER_CALL ||
        (launch.granted > 0 && launch.remaining > 0) ||
        // 지급·무효 모두 최종 상태라 진전이다 — 실패만 있었으면 반복하지 않는다
        (settledReferralCount(referral) > 0 && referral.remaining > 0)),
  });
}

export const POST = GET;
