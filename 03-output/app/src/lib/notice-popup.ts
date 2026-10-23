/**
 * 사이트 공지 팝업 — 띄울지 판단하는 규칙과 브라우저 저장소 키.
 * 저장소 접근(try/catch)은 컴포넌트에서 하고, 여기서는 읽은 값만 받아 판단한다.
 */
export const HIDE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function hideKey(noticeId: string): string {
  return `tm-notice-hide:${noticeId}`;
}

export function closedKey(noticeId: string): string {
  return `tm-notice-closed:${noticeId}`;
}

/** "일주일 동안 보지 않기" 를 누른 시각 기준 숨김 만료 시각 (epoch ms) */
export function hideUntilFrom(now: number): number {
  return now + HIDE_DAYS * DAY_MS;
}

export function shouldShowNotice(args: {
  now: number;
  /** 공지 게시 종료 시각 (ISO 8601, 시간대 포함) — 지나면 아무에게도 띄우지 않는다 */
  showUntil: string;
  /** localStorage 에 저장된 숨김 만료 시각. 없거나 깨진 값이면 null/NaN 으로 들어온다 */
  hiddenUntil: string | null;
  /** 이번 브라우저 세션에서 "닫기" 를 눌렀는지 */
  closedThisSession: boolean;
}): boolean {
  if (args.closedThisSession) return false;
  if (args.now >= Date.parse(args.showUntil)) return false;
  const hiddenUntil = Number(args.hiddenUntil);
  if (Number.isFinite(hiddenUntil) && hiddenUntil > args.now) return false;
  return true;
}
