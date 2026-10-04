/**
 * 문의 접수 규칙 — 순수 함수 (DB·네트워크 없음, 단위 테스트 대상).
 */

/** 한 회원이 24시간 동안 남길 수 있는 문의 수 */
export const INQUIRY_DAILY_LIMIT = 5;
/** 연속 접수 최소 간격 (더블 클릭·도배 방지) */
export const INQUIRY_MIN_INTERVAL_MS = 60 * 1000;
export const INQUIRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RateLimitDecision = { ok: true } | { ok: false; message: string };

/**
 * @param recentCreatedAt 이 회원이 최근 24시간 안에 남긴 문의의 접수 시각(ISO)
 */
export function inquiryRateLimit(recentCreatedAt: string[], now: Date): RateLimitDecision {
  const times = recentCreatedAt
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t) && now.getTime() - t < INQUIRY_WINDOW_MS);

  const latest = times.length === 0 ? null : Math.max(...times);
  if (latest !== null && now.getTime() - latest < INQUIRY_MIN_INTERVAL_MS) {
    return { ok: false, message: "방금 문의가 접수되었습니다. 1분 뒤에 다시 시도해주세요." };
  }
  if (times.length >= INQUIRY_DAILY_LIMIT) {
    return {
      ok: false,
      message: `문의는 24시간에 ${INQUIRY_DAILY_LIMIT}건까지 남길 수 있습니다. 기존 문의의 답변을 기다려주세요.`,
    };
  }
  return { ok: true };
}
