/**
 * 체크인 day_n 계산.
 * day_n = 1 부터 시작 (옵트인 직후 24h 내 = day 1).
 * 14를 초과하면 0(=invalid) 반환.
 */
export function currentDayN(optedInAt: string): number {
  const elapsedMs = Date.now() - new Date(optedInAt).getTime();
  if (elapsedMs < 0) return 0;
  const day = Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1;
  return day >= 1 && day <= 14 ? day : 0;
}
