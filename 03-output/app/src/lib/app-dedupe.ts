export type AppIdentity = { name: string; store_invite_url?: string | null };

/**
 * 같은 소유자 안에서 "같은 앱"인지 가리는 키 — 앱 이름 + 스토어 초대 링크.
 * 이름은 대소문자·앞뒤/연속 공백·한글 자모 분리(macOS 에서 붙여넣은 NFD) 차이를 무시한다.
 * 링크는 경로에 대소문자 구분 토큰이 들어가므로 앞뒤 공백만 정리한다.
 */
export function appDedupeKey(app: AppIdentity): string {
  const name = app.name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  const storeUrl = (app.store_invite_url ?? "").trim();
  return JSON.stringify([name, storeUrl]);
}
