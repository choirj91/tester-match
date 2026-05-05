/**
 * Cron 엔드포인트 보호용 secret 검증.
 * - 운영: Cloudflare Cron Trigger 호출 시 Authorization: Bearer ${CRON_SECRET} 헤더 필수.
 * - 로컬/CI: CRON_SECRET 미설정 시 항상 통과 (개발 편의 — 운영 배포 시 반드시 설정).
 */
export function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
