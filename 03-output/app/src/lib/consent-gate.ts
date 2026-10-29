import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * 미들웨어가 요청 경로(쿼리 포함)를 서버 컴포넌트에 넘기는 헤더.
 * 미들웨어가 매 요청 덮어쓰므로 브라우저가 보낸 값은 쓰이지 않는다.
 */
export const PATHNAME_HEADER = "x-tm-pathname";

export const CONSENT_PATH = "/auth/consent";

/**
 * 시행 중인 약관에 동의하지 않은 회원을 동의 화면으로 보낼 경로인가.
 * 로그인·동의 화면, 정책 원문, API(탈퇴 포함)는 열어 둔다.
 */
export function isConsentGated(pathWithSearch: string): boolean {
  const pathname = pathWithSearch.split(/[?#]/, 1)[0];
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  return !under("/api") && !under("/auth") && !under("/policies");
}

/** 동의 뒤 돌아갈 경로 — 사이트 안으로 제한하고, 동의 화면 자신은 홈으로 바꾼다 (무한 이동 방지) */
export function consentNextPath(next: string | null | undefined, origin: string): string {
  const path = safeInternalPath(next, origin);
  return isConsentGated(path) ? path : "/";
}

export function consentPagePath(next: string, error?: "agree" | "save"): string {
  const params = new URLSearchParams({ next });
  if (error) params.set("error", error);
  return `${CONSENT_PATH}?${params.toString()}`;
}
