/**
 * 로그인 뒤 돌아갈 경로를 우리 사이트 안으로 제한한다 (오픈 리다이렉트 방지).
 *
 * "/" 로 시작하는지만 보면 부족하다 — 브라우저는 "/\evil.com" 이나 탭·줄바꿈이 낀 "/<tab>/evil.com"
 * 을 "//evil.com" 으로 해석해 밖으로 나간다. URL 로 실제 해석한 뒤 출처가 같은지 확인한다.
 */
export function safeInternalPath(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    // "/.//evil.com" 처럼 해석 후 경로가 "//" 로 시작하면, 그 문자열을 다시 주소로 쓰는 순간 밖으로 나간다
    if (url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
