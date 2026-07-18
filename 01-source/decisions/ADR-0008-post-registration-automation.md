### ADR-0008: 사업자 등록 이후 자동화 스택 도입

- **상태**: Accepted (2026-07-14)
- **결정자**: nakjun (Knock Knock Company 대표)
- **관련 결정**: ADR-0002 (Cloudflare+Supabase), ADR-0004 (Auth), ADR-0007 (결제 이연)

---

## Context

Knock Knock Company 사업자 등록 완료. 이 시점에서 이전에 접근 불가했던 다음 자산·API 가 사용 가능:

1. **커스텀 도메인** — 법인 명의로 도메인 소유 가능
2. **Cloud Identity Free** — 도메인 기반 Google 계정 관리, 50명 무료
3. **Google Workspace 그룹 API** — 도메인 하에서 Admin SDK Directory API 사용
4. **androidpublisher / Play Console API** — 사업자 명의 Play Console 개설 후 서비스 계정 위임 가능
5. **정식 결제 (v2 활성화 시)** — 토스페이먼츠 등 심사 통과 가능

기존까지의 서비스는 등록 없이 운영 가능한 최소 자동화만 제공했으며, 다음 문제점 존재:

| 문제 | 현재 상태 |
|---|---|
| 앱 등록 폼 수동 입력 부담 | 개발자가 5개 필드 직접 입력 |
| 개발자·테스터 매칭 후 Play Console 수동 tester 등록 | 개별 이메일 하나씩 등록해야 함 |
| 신규 유저 온보딩 이탈 | 가입 후 첫 매칭까지 40%+ 이탈 추정 |
| 개발자에게 앱 성과 가시성 부족 | 활성 카운트만 표시, 추이·이탈률 없음 |

## Decision

이 브랜치(`feat/post-registration-automation`)에서 다음 자동화를 도입한다:

### 1. Play Store URL → 앱 정보 자동 파싱 (F-APP-03)
- Play Store 앱 상세 URL 하나로 이름·설명·초대 링크 자동 채움
- Edge runtime 에서 fetch → OG 메타 파싱 → 폼 필드 자동 세팅
- 외부 의존성 없음, 즉시 활성

### 2. Google Workspace 공용 테스터 풀 (F-AUTH-01)
- 하나의 Google 그룹(`testers@knockknockcompany.com` 등) 을 Tester Match 회원 공용 풀로 운영
- 회원가입 시 자동으로 이 그룹에 추가 (Admin SDK Directory API)
- 개발자는 Play Console 클로즈드 트랙의 tester group 으로 이 그룹 하나만 등록하면 전체 커뮤니티가 즉시 테스터로 잡힘
- 서비스 계정 + Domain-Wide Delegation 기반. 환경변수로 활성/비활성 토글 가능
- **개발자별 Play Console 인증 없이 매칭 자동화 절반 달성**

### 3. 온보딩 진행률 카드 (F-UX-01)
- 3단계: 회원가입 → 첫 앱 등록 → 첫 매칭 참여
- 모두 완료 시 자동 숨김
- 신규 유저 활성화율 개선 목표

### 4. 개발자 KPI 대시보드 (F-UX-02)
- 앱 관리 페이지에 총 매칭 / 완주율 / 이탈률 / 활성 진행률
- 최근 7일 신규 매칭 막대 차트 (KST 기준)
- 개발자 재방문·리텐션 지표 개선

### 5. Play Console API 개별 연동 — 이 브랜치 범위 아님 (F-PLAY-01, 이후 브랜치)
- 개별 개발자별 서비스 계정 위임으로 실제 설치·DAU 조회 및 tester 자동 등록
- 도메인 위임 대신 개별 승인 필요 → 큰 UX 작업 → 별도 이터레이션

## Why

- **공용 그룹 방식 (F-AUTH-01)** 선택 이유: 개발자별 API 인증 없이 즉시 자동화 절반 달성. 커뮤니티 응집력 강화. 개별 인증은 추후 P4 로 이연
- **환경변수 미설정 시 no-op**: 개발/스테이징/폴백 안정성 확보
- **1회성 그룹 가입 (`groups_joined_at` 컬럼)**: 매 요청마다 Directory API 호출 방지, 쿼터 안전
- **KPI 자체 구현 (외부 분석 X)**: DB 쿼리로 계산 가능한 지표만 우선 지원, GA/Amplitude 도입 이연

## Consequences

**Positive:**
- doply 수준 자동화의 절반 흡수 (공용 그룹). 무료 정체성 유지
- 신규 유저 온보딩 이탈률 개선 기대
- 개발자에게 데이터 기반 인사이트 제공 → 재방문 증가

**Negative:**
- Cloud Identity Free 50명 제한 → 500명 이상 확장 시 유료 (Workspace Business Starter, 월 7,200원/유저)
- 실제로 500명 이상 자동 가입되면 유료 전환 강제
- Domain-Wide Delegation = 강력한 권한 → 서비스 계정 JSON 유출 시 도메인 전체 Directory 조작 가능. 시크릿 관리 엄격 필요

**Mitigations:**
- Cloud Identity 50명 초과 대비: `TESTER_GROUP_EMAIL` 만 수동 관리하도록 폴백 준비 (v3)
- 서비스 계정 JSON 은 Cloudflare Pages 시크릿에만 저장, GitHub / 로컬 파일 커밋 금지
- 스코프를 `admin.directory.group.member` 로 최소화 (전체 Directory 접근 X)

## 잠금 결정 충돌 여부

- ADR-0001 한국 우선: 유지 (한국어 UI, KST)
- ADR-0002 Cloudflare Pages + Supabase: 유지 (Edge runtime 호환 코드)
- ADR-0003 1원=1크레딧: 무관 (결제 v2 여전히 이연)
- ADR-0004 인증 전략: 확장 (기존 Google OAuth 유지 + Workspace 그룹 자동 등록 추가)
- ADR-0007 결제 v2 이연: 유지 (수익 채널은 AdSense 우선)

새 잠금 결정 갱신 없음. 기존 결정과 충돌 없음.

## 배포 절차

`04-review/history/2026-07-14-post-registration-automation.md` 참조.
