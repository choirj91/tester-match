/**
 * 이메일 가입 인증 (ADR-0013 보강) — 순수 헬퍼.
 *
 * 인증 메일은 인증 서버 주소가 아니라 우리 사이트로 보낸다. 메일 보안 스캐너가 링크를 미리
 * 열어도 인증이 확정되지 않도록, 링크(GET)는 토큰을 쿠키에 옮겨 담기만 하고 확인 화면에서
 * 닉네임·비밀번호를 입력하고 약관에 동의해야(POST) 확정된다. 확인 화면 주소에는 토큰이 없어 광고·분석
 * 스크립트에 노출되지 않는다.
 */

/**
 * 링크에서 받은 토큰을 확인 화면까지 옮기는 쿠키 (HttpOnly).
 * __Host- 접두사: Secure + Path=/ + Domain 없음일 때만 브라우저가 받아 주므로 다른 서브도메인이 덮어쓸 수 없다.
 */
export const CONFIRM_COOKIE = "__Host-tm_signup_confirm";
/** 쿠키 수명 — 인증 토큰 유효시간(1시간)을 넘기지 않는다 */
export const CONFIRM_COOKIE_MAX_AGE_SECONDS = 60 * 60;

/** GoTrue 가 발급하는 해시 토큰 — 16진수, PKCE 흐름이면 pkce_ 접두사 */
const TOKEN_HASH_PATTERN = /^(pkce_)?[a-f0-9]{32,128}$/i;

/** 사전등록 판정 여유 — 가입 시각과 행 생성 시각의 서버 간 시계 차이를 흡수한다 */
const PRE_REGISTERED_MARGIN_MS = 60 * 1000;

export function isValidTokenHash(value: unknown): value is string {
  return typeof value === "string" && TOKEN_HASH_PATTERN.test(value);
}

export function buildConfirmUrl(siteUrl: string, tokenHash: string): string {
  return `${siteUrl}/api/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}`;
}

/**
 * 로그인에 연결된 회원 행이 가입 이전부터 있던 사전등록(일괄 등록) 행인지.
 * 새로 만들어진 행은 인증 시점에 생기므로 가입 시각보다 늦다.
 * 시각을 읽을 수 없으면 사전등록으로 본다 — 이 판정은 "지워도 되는 새 행인가"에 쓰이므로
 * 모를 때는 지우지 않는 쪽이 안전하다.
 */
export function isPreRegisteredRow(rowCreatedAt: string, authCreatedAt: string): boolean {
  const rowTime = Date.parse(rowCreatedAt);
  const authTime = Date.parse(authCreatedAt);
  if (Number.isNaN(rowTime) || Number.isNaN(authTime)) return true;
  return rowTime < authTime - PRE_REGISTERED_MARGIN_MS;
}

/**
 * 양식 제출이 우리 사이트 화면에서 온 것인지. SameSite=Lax 쿠키는 다른 사이트의 POST 에는
 * 실리지 않지만 같은 상위 도메인의 다른 서브도메인에서는 실린다 — 출처까지 확인한다.
 */
export function isSameOriginRequest(requestUrl: string, headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin) return origin === new URL(requestUrl).origin;
  return headers.get("sec-fetch-site") === "same-origin";
}

/**
 * 아무도 모르는 임시 비밀번호. 인증 전 계정은 이 값으로만 존재하고,
 * 실제 비밀번호는 메일 링크를 연 사람이 확인 화면에서 정한다.
 */
export function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

export type ConfirmResult =
  | { ok: true }
  /**
   * link: 링크가 만료·사용됨 / password: 인증은 됐지만 비밀번호 저장 실패 /
   * member: 인증과 비밀번호는 됐지만 회원 행이 없음
   */
  | { ok: false; reason: "link" | "password" | "member" };

const CONFIRM_ERROR_CODE: Record<"link" | "password" | "member", string> = {
  link: "confirm_failed",
  password: "confirm_password_failed",
  member: "confirm_member_failed",
};

/** 인증 처리 후 돌아갈 로그인 화면 경로 */
export function confirmResultPath(result: ConfirmResult): string {
  if (result.ok) return "/auth/login?verified=1";
  return `/auth/login?error=${CONFIRM_ERROR_CODE[result.reason]}`;
}
