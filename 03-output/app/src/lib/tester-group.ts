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
