/**
 * Cron 엔드포인트 보호용 secret 검증.
 * - Authorization: Bearer ${CRON_SECRET} 헤더가 맞아야 통과.
 * - CRON_SECRET 이 없으면 기본 거부 (fail closed). 로컬 .env.local 은 운영 DB·실메일 키를
 *   가리키므로, 비밀이 빠진 환경에서 크론이 열리면 운영 데이터가 바뀐다 (2026-10-04 사고).
 *   테스트 러너이거나 CRON_ALLOW_UNAUTHENTICATED=1 을 명시했을 때만 비밀 없이 통과.
 */
export function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "test" || process.env.CRON_ALLOW_UNAUTHENTICATED === "1";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
