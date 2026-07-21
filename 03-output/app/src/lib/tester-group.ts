/**
 * Tester Match 공용 테스터 그룹 — 클라이언트/서버 공용 상수.
 *
 * 모든 앱은 이 그룹 하나를 Play Console Closed Testing 트랙에 등록한다.
 * Tester Match 회원은 로그인 시 자동으로 이 그룹에 가입되므로 (F-AUTH-01),
 * 그룹 멤버 = 전체 회원 = 모든 앱의 승인된 테스터.
 *
 * 서버 전용 로직(Directory API)은 google-groups.ts 의 env 기반 값을 쓰고,
 * UI 표시는 이 상수를 쓴다. 도메인 변경 시 두 곳 모두 갱신.
 */
export const TESTER_GROUP_EMAIL = "testers@knockknock.company";
export const TESTER_GROUP_URL =
  "https://groups.google.com/a/knockknock.company/g/testers";

/**
 * Play Console 등록용 공개 그룹 (consumer Google Groups).
 * Play Console 이 커스텀 도메인(Workspace) 그룹을 인식하지 못해
 * 개발자가 트랙에 등록하는 그룹은 이쪽을 사용한다.
 * consumer 그룹은 API 가 없어 자동 추가 불가 — 테스터가 1클릭 가입.
 */
export const PLAY_GROUP_EMAIL = "tester-match@googlegroups.com";
export const PLAY_GROUP_URL = "https://groups.google.com/g/tester-match";
/** 로그인 상태에서 바로 가입 버튼이 뜨는 정보 페이지 */
export const PLAY_GROUP_JOIN_URL = "https://groups.google.com/g/tester-match/about";
