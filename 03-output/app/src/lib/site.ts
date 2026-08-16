/** 사이트 기본 URL — 신규 코드는 하드코딩 대신 이 상수 사용 */
export const SITE_URL = "https://tester-match.knockknock.company";
export const SITE_NAME = "Tester Match";
export const COMPANY_NAME = "Knock Knock Company (낰낰컴퍼니)";
export const CONTACT_EMAIL = "admin@knockknock.company";

/** 사업자 정보 — 푸터·약관 등 대외 표기의 단일 소스 */
export const BUSINESS = {
  name: "낰낰컴퍼니 (Knock Knock Company)",
  registrationNumber: "441-20-02677",
  address: "경기도 용인시 기흥구 기흥로116번길 7, 104동 605호 (16959)",
  email: CONTACT_EMAIL,
} as const;
/** 카카오 오픈채팅방 (커뮤니티 공지 대상) */
export const OPEN_CHAT_URL = "https://open.kakao.com/o/ghJ9350f";
