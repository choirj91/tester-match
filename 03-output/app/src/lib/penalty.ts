import { currentDayN } from "@/lib/checkin";

/**
 * 페널티 부과 판정 (F-CHK-06).
 *
 * 부과 조건:
 *   - 14일 기간 종료(currentDayN === 0) 인데 14 미만 체크인 → 페널티
 *   - 또는 마지막 체크인 후 5일 이상 연속 미체크인 → 페널티
 *
 * @param optedInAt 옵트인 시각 ISO
 * @param distinctCheckinDays 매칭에서 실제 체크인된 day_n 의 개수
 * @param lastCheckinDayN 마지막 체크인의 day_n. 체크인 없으면 0.
 */
export function shouldPenalize(
  optedInAt: string,
  distinctCheckinDays: number,
  lastCheckinDayN: number,
): boolean {
  const cur = currentDayN(optedInAt);
  if (cur === 0) {
    return distinctCheckinDays < 14;
  }
  return cur - lastCheckinDayN >= 5;
}

export const PENALTY_TRUST_DELTA = -10;
