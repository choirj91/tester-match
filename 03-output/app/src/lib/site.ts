/** 사이트 기본 URL — 신규 코드는 하드코딩 대신 이 상수 사용 */
export const SITE_URL = "https://tester-match.knockknock.company";
export const SITE_NAME = "Tester Match";
export const COMPANY_NAME = "Knock Knock Company (낰낰컴퍼니)";
export const CONTACT_EMAIL = "admin@knockknock.company";

/**
 * 사업자 정보 — 푸터·약관 등 대외 표기의 단일 소스.
 * 주소는 사업자등록증 주소에서 동·호수를 뺀 건물 단위까지만 표기한다 (자택 — 2026-10-05 운영자 결정).
 * 통신판매업 신고번호는 신고 후 추가한다 (신고 전에는 표기하지 않는다).
 */
export const BUSINESS = {
  name: "낰낰컴퍼니 (Knock Knock Company)",
  representative: "최낙준",
  registrationNumber: "441-20-02677",
  address: "경기도 용인시 기흥구 기흥로116번길 7",
  phone: "070-8204-3219",
  email: CONTACT_EMAIL,
} as const;
/** 카카오 오픈채팅방 (커뮤니티 공지 대상) */
/** Google Play 비공개 테스트 요건 — 테스터 수 (기간은 seat-reward-rules 의 SEAT_TOTAL_DAYS) */
export const PLAY_CLOSED_TEST_TESTERS = 12;
export const OPEN_CHAT_URL = "https://open.kakao.com/o/ghJ9350f";
