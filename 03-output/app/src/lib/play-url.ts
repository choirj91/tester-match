/**
 * 회원이 입력한 링크(초대 링크·Google 그룹 링크)가 정해진 Google 주소인지 확인한다.
 *
 * 주소 문자열에 "play.google.com" 이 들어 있는지만 보면
 * `https://evil.example/?play.google.com` 이나 `https://play.google.com.evil.example`
 * 같은 가짜 주소가 통과한다 (2026-10-23 가짜 캡차 사고 점검에서 발견). 그래서 URL 을 파싱해
 * 프로토콜이 https 이고 호스트가 정확히 일치하는 경우만 허용한다.
 */
export const PLAY_HOST = "play.google.com";
export const GROUPS_HOST = "groups.google.com";

function isHttpsUrlOnHost(value: string | null | undefined, host: string): value is string {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" && url.hostname === host && url.username === "" && url.password === ""
  );
}

export function isPlayStoreUrl(value: string | null | undefined): value is string {
  return isHttpsUrlOnHost(value, PLAY_HOST);
}

export function isGoogleGroupUrl(value: string | null | undefined): value is string {
  return isHttpsUrlOnHost(value, GROUPS_HOST);
}
