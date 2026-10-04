import { SITE_URL } from "@/lib/site";

/**
 * 방문자가 실제로 접속한 사이트 주소 (리다이렉트·출처 비교용).
 *
 * Next standalone 서버(Azure App Service)에서는 `request.url` 이 바인딩 주소
 * (`http://0.0.0.0:8080/...`)로 만들어진다 — 이 값으로 리다이렉트를 만들면 로그인 후
 * `https://0.0.0.0:8080/` 으로 튕긴다 (2026-10-05). 이때는 Host 헤더로 공개 주소를 복원하되,
 * 우리 호스트 목록에 있을 때만 쓴다 (Host 헤더 위조로 다른 사이트로 보내지 못하게).
 * 목록에 없으면 운영 주소(SITE_URL)로 보낸다.
 */
const BIND_HOSTS = new Set(["0.0.0.0", "[::]", "::"]);

function allowedHosts(): Set<string> {
  const hosts = new Set<string>([new URL(SITE_URL).host]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host);
    } catch {
      // 잘못된 값이면 무시
    }
  }
  // App Service 가 넣어 주는 기본 호스트 (*.azurewebsites.net)
  const azureHost = process.env.WEBSITE_HOSTNAME;
  if (azureHost) hosts.add(azureHost.toLowerCase());
  return hosts;
}

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  // next dev·edge 처럼 request.url 이 실제 주소면 그대로 쓴다
  if (!BIND_HOSTS.has(url.hostname)) return url.origin;

  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (host && allowedHosts().has(host)) return `https://${host}`;
  return SITE_URL;
}
