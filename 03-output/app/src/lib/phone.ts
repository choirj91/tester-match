/**
 * 국내 휴대폰 번호 검증 — 결제창(KG이니시스 구매자 정보)과 보상 발송 연락처에 공용.
 * 하이픈·공백을 걷어낸 숫자만 돌려주고, 형식이 아니면 null.
 */
const KR_MOBILE_DIGITS = /^01[016789]\d{7,8}$/;

export function normalizeKoreanMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return KR_MOBILE_DIGITS.test(digits) ? digits : null;
}
