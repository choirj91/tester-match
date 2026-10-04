/**
 * 남용 제한·감사 해시에 쓰는 클라이언트 IP.
 *
 * 클라이언트가 위조할 수 없는 값은 "우리 바로 앞단"이 붙인 헤더뿐이다. 어떤 헤더가 그것인지는
 * 앞단 구성에 따라 다르므로 CLIENT_IP_HEADER 로 고른다 (기본 x-forwarded-for).
 * - x-forwarded-for (기본): Azure App Service 가 첫 홉이면 프런트엔드가 실제 접속 주소를
 *   맨 뒤에 덧붙인다 → 마지막 항목을 쓴다. 포트가 붙어 올 수 있다 ("1.2.3.4:5678").
 * - cf-connecting-ip: Cloudflare 프록시를 앞에 둘 때. 원본이 Cloudflare 경유만 받도록
 *   잠겨 있을 때만 안전하다.
 * - x-azure-clientip: Front Door 를 앞에 둘 때.
 * 앞단을 추가하면(프록시·Front Door) 마지막 XFF 항목은 그 앞단의 주소가 되어 모든 가입이
 * 한 버킷을 공유한다 — 구성을 바꾸면 이 값을 반드시 같이 바꾼다. 전환 전 스테이징에서 실측.
 */
export const DEFAULT_CLIENT_IP_HEADER = "x-forwarded-for";

export function clientIpHeaderFromEnv(
  value: string | undefined = process.env.CLIENT_IP_HEADER,
): string {
  const name = value?.trim().toLowerCase();
  return name ? name : DEFAULT_CLIENT_IP_HEADER;
}

/** "1.2.3.4:5678" → "1.2.3.4", "[2001:db8::1]:443" → "2001:db8::1". 포트 없는 IPv6 는 그대로. */
export function stripPort(raw: string): string {
  const value = raw.trim();
  const bracketed = value.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1];
  const colonCount = value.split(":").length - 1;
  if (colonCount === 1) return value.slice(0, value.indexOf(":"));
  return value;
}

/** 지정한 헤더의 마지막 항목 (단일 값 헤더면 그 값). 없으면 null. */
export function clientIpFromHeaders(
  headers: Headers,
  headerName: string = clientIpHeaderFromEnv(),
): string | null {
  const raw = headers.get(headerName);
  if (!raw) return null;
  const last = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return last ? stripPort(last) : null;
}
