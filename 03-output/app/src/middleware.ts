import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 구 도메인(tester-match.pages.dev) → 커스텀 도메인 영구 리다이렉트.
 * 308 = 메서드 보존. 프리뷰 배포(<hash>.tester-match.pages.dev)는
 * host 가 정확히 일치하지 않으므로 리다이렉트되지 않는다.
 */
/**
 * 자체 운영 GoTrue(ADR-0015 2단계)로 넘기는 /auth/v1 중 외부에 열면 안 되는 경로.
 * - signup: 우리 가입 화면(서버가 인증 링크 생성)을 거치지 않는 계정 생성 (ADR-0013 지적 사항)
 * - admin: 서비스 키가 있어야 동작하지만 외부에서 닿을 이유가 없다 (방어선 한 겹 더)
 * 서버는 localhost 로 GoTrue 를 직접 부르므로 이 차단의 영향을 받지 않는다.
 */
export function isBlockedAuthPath(pathname: string): boolean {
  return /^\/auth\/v1\/(signup|admin)(\/|$)/.test(pathname);
}

export function middleware(req: NextRequest) {
  if (isBlockedAuthPath(req.nextUrl.pathname)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const host = req.headers.get("host");
  if (host === "tester-match.pages.dev") {
    const url = new URL(req.url);
    url.host = "tester-match.knockknock.company";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}
