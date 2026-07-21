# ADR-0009: 이중 Google 그룹 아키텍처 (Play용 consumer + 내부 Workspace)

- **날짜**: 2026-07-21
- **상태**: 채택
- **관련**: ADR-0008 (등록 후 자동화)

## Context

Play Closed Testing 테스터 자격은 Play Console에 등록된 Google 그룹 멤버십으로 판정된다.
당초 설계: Workspace 커스텀 도메인 그룹 `testers@knockknock.company` 하나로 통일하고, 회원 로그인 시 Directory API로 자동 가입시켜 "로그인 = 테스터 자격"을 구현.

실측 결과 (2026-07-18 ~ 07-21, 3일 검증):

1. **Play Console이 커스텀 도메인(Workspace) 그룹을 인식하지 못함.** 조직 공유 "인터넷의 모든 사용자에게 공개", 그룹 보기/가입 전면 공개, 시크릿 창에서 그룹명 노출 확인까지 완료했음에도 "이 Google 그룹이 존재하지 않거나 액세스 권한이 없습니다" 3일간 지속. 동일 조건에서 consumer 그룹(`@googlegroups.com`)은 즉시 인식.
2. **중첩 우회 불가.** consumer 그룹에 Workspace 그룹을 멤버로 추가 시도 → "그룹은 다른 그룹에 추가될 수 없습니다" (consumer 그룹은 그룹 중첩 미지원).
3. **consumer 그룹은 API가 없음.** Admin SDK Directory API는 자기 도메인 그룹만 관리 가능. 서버가 회원을 `@googlegroups.com` 그룹에 자동 추가할 방법이 존재하지 않음 (웹 봇 자동화는 약관 위반).

즉 "완전 자동 가입"과 "Play Console 호환"을 동시에 만족하는 단일 그룹은 Google 제약상 불가능.

## Decision

그룹을 역할별로 분리한다:

| 그룹 | 유형 | 역할 | 가입 방식 |
|---|---|---|---|
| `tester-match@googlegroups.com` | consumer | **Play Console 등록용** (테스터 자격) | 테스터 1클릭 웹 가입 (버튼 상시 노출) |
| `testers@knockknock.company` | Workspace | 내부 회원 명단 관리·향후 활용 | 로그인 시 Directory API 자동 등록 (유지) |
| `testers-pro@knockknock.company` | Workspace | 유료 티어 — 회사 계정 20개 운영 대행 | 관리자 초대만 |

UI 원칙:
- 가입 버튼(`PlayGroupJoinPrompt`)은 브라우즈 상세·앱 등록·내 테스트·프로필 등 모든 접점에 **상시 노출** (가입 여부 자가확인 상태는 오조작 문제로 폐기 — 커밋 80e5ab8)
- 개발자 노출 문구의 Play Console 등록 이메일은 전부 `PLAY_GROUP_EMAIL` 상수 사용
- "로그인만으로 자동 가입" 류 문구 전면 금지 (사실 아님)

코드 앵커: `03-output/app/src/lib/tester-group.ts` (`PLAY_GROUP_EMAIL`, `PLAY_GROUP_JOIN_URL`, `TESTER_GROUP_EMAIL`)

## Why

- consumer 그룹 사용이 Play 호환의 유일한 검증된 경로 (즉시 인식 실측)
- 1클릭 가입은 반자동이지만 1회성 — 한 번 가입하면 모든 앱 커버, 마찰 수용 가능
- Workspace 자동 가입 인프라는 이미 구축·무비용 — 회원 명단 관리 가치로 유지
- 폴백 존재: Play Console "이메일 목록" 방식 (앱별 매칭 테스터 이메일 복사) — 그룹 방식마저 문제 시

## Consequences

- (+) Play Console 등록 즉시 동작, 개발자 마찰 최소화
- (+) 자동 가입 인프라 무손실 보존
- (−) 테스터에게 1클릭 가입 액션 요구 — UI 안내로 완화
- (−) 서비스가 consumer 그룹 멤버십을 확인할 방법 없음 (API 부재) — "가입 안 했으면 초대 링크 안 열림" 안내로 대체
- (−) 그룹 2개 운영 — 문구·상수 관리 주의 (`tester-group.ts` 단일 소스)
