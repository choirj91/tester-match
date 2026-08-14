import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 구 도메인(tester-match.pages.dev) → 커스텀 도메인 영구 리다이렉트.
 * 308 = 메서드 보존. 프리뷰 배포(<hash>.tester-match.pages.dev)는
 * host 가 정확히 일치하지 않으므로 리다이렉트되지 않는다.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (host === "tester-match.pages.dev") {
    const url = new URL(req.url);
    url.host = "tester-match.knockknock.company";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}
