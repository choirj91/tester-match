/**
 * 페널티 스윕의 매칭 판정 — 순수 함수 (현재 시각 외 입력 없음, 단위 테스트 대상).
 * 일차 계산은 옵트인 시각 기준 24시간 단위(lib/checkin.ts)라 서버 타임존과 무관하다.
 */

import { currentDayN } from "@/lib/checkin";
import { shouldPenalize } from "@/lib/penalty";
import { paidSeatVerdict } from "@/lib/seat-reward-rules";

/** 건별 예상 서브리퀘스트 수 — 요청당 상한(50)을 넘기 전에 멈추기 위한 추정치 */
export const COST_FREE_PENALTY = 8;
export const COST_PAID_DROP = 21;
export const COST_PAID_COMPLETE = 16;

export type SweepCheckin = { day_n: number; screenshot_url: string | null };
export type MatchVerdict = "ok" | "complete" | "fail";

/** 매칭 하나의 판정과 처리 비용 */
export function judgeMatch(args: {
  optedInAt: string;
  isPaidSeat: boolean;
  checkins: SweepCheckin[];
}): { verdict: MatchVerdict; cost: number; distinctCount: number } {
  // 유료 시트는 스크린샷 증빙이 있는 날만 출석으로 센다 (보상 계산과 같은 기준)
  const counted = args.isPaidSeat ? args.checkins.filter((c) => c.screenshot_url) : args.checkins;
  const distinctDays = new Set(counted.map((c) => c.day_n));
  const distinctCount = distinctDays.size;
  const lastDay = distinctCount === 0 ? 0 : Math.max(...distinctDays);

  if (!args.isPaidSeat) {
    const verdict = shouldPenalize(args.optedInAt, distinctCount, lastDay) ? "fail" : "ok";
    return { verdict, cost: COST_FREE_PENALTY, distinctCount };
  }
  // 유료 시트: 12/14 유예 규칙. 결석 3일째에 즉시 해제, 기간 종료 시 12일 이상이면 완주(보상 보류)
  const verdict = paidSeatVerdict(currentDayN(args.optedInAt), distinctCount, lastDay);
  return {
    verdict,
    cost: verdict === "complete" ? COST_PAID_COMPLETE : COST_PAID_DROP,
    distinctCount,
  };
}
