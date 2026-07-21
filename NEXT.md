# NEXT — 다음 액션

> **현재 위치**: MVP 라이브 운영 중 (https://tester-match.pages.dev, 회원 850+)
> **회사**: Knock Knock Company (사업자 등록 완료) · 도메인 knockknock.company 확보
> **마지막 업데이트**: 2026-07-21

---

## 🔥 즉시 (사용자 액션 — 코드 아님)

- [ ] **공용 그룹 최종 검증** — `tester-match@googlegroups.com`
  - [ ] groups.google.com 설정 확인: 그룹 보기 "웹의 모든 사용자" / 가입 "웹상의 모든 사용자가 가입 가능"(승인 없이)
  - [ ] 본인 Play Console 테스터 탭에 `tester-match@googlegroups.com` 등록 → 인식되는지
  - [ ] 본인 gmail로 그룹 가입 → 앱 웹 옵트인 링크에서 "테스터 되기" 나오는지
- [ ] 검증 통과 후 **문의 개발자 회신** (ilovejs97@gmail.com 등) + **공지 글 게시** ("그룹 등록 정상화 + 새 참여 방법")
- [ ] **tester02~20 최초 로그인** — 실기기, 며칠 분산, 같은 복구번호 반복 금지 (tester01 차단 사례 참고)
- [ ] tester01~20 → `testers-pro@knockknock.company` 그룹 등록
- [ ] AdSense 심사 결과 대기 → 승인 시 `feat/adsense-placements` 병합 + 슬롯 ID 4개 발급·기입

## 코드 작업 (다음 세션)

- [ ] 그룹 검증 실패 시 폴백: 앱별 "참여 테스터 이메일 목록 복사" 기능 (Play Console 이메일 목록 방식)
- [ ] 프로필 확장 검토 — 자기소개·연락 수단 필드 (사용자 언급)
- [ ] 유료(Pro) 티어 상품화 — testers-pro 그룹 20계정 운영 대행 페이지 + 가격
- [ ] 커스텀 도메인 이전 (knockknock.company) — AdSense 승인 이후 권장 (심사 도중 도메인 변경 금지)

## 그룹 아키텍처 (확정 — [ADR-0009](01-source/decisions/ADR-0009-dual-group-architecture.md))

```
tester-match@googlegroups.com   ← Play Console 등록용 (consumer). 테스터 1클릭 가입. API 없음 → 자동 추가 불가
testers@knockknock.company      ← 내부 명단 (Workspace). 로그인 시 Directory API 자동 등록. Play Console 미인식
testers-pro@knockknock.company  ← 유료 티어. 회사 계정 20개(tester01~20)로 운영 대행
```

## 백로그

- [ ] 웹 푸시 알림
- [ ] Play Console API 설치 검증 (개발자 본인 앱 설치 수 자동 집계)
- [ ] 유료 급구 (토스페이먼츠) — [ADR-0007](01-source/decisions/ADR-0007-payments-v2-defer.md) 보류 중
- [ ] UptimeRobot 등록 (Supabase Free 일시정지 방지)
- [ ] 변호사 검토 (이용약관·개인정보처리방침, 출시 규모 커지기 전)

---

## 최근 완료 (2026-07 하이라이트)

| 날짜 | 작업 |
|---|---|
| 07-21 | 이중 그룹 아키텍처 배포 — Play용 consumer 그룹 + 가입 버튼 전 페이지 노출 |
| 07-20 | 공지사항 시스템 (관리자 전용 카테고리, 플로팅 버튼, post_reads), 조회수 실집계, PGRST201 임베드 장애 복구 |
| 07-19 | 관리자 표시 (댓글 배지·게시판 칩), 그룹 전환 배너·일괄 알림 |
| 07-18 | 공용 그룹 전면 적용 (폼 고정, 실시간 상태), Workspace 자동 가입 (Directory API) |
| 07-17 | 사업자 등록 후 자동화 — Play Store URL 자동 채움, 온보딩, KPI 대시보드 |
| 07-16 | AdSense 심사 신청, 광고 배치는 `feat/adsense-placements` 브랜치 보존 후 main 리버트 |
| 07-15 | 급구 무료 오픈 (7일 자동 만료·랜덤 셔플), 카톡 공유 3단계 모달 |

상세: [WORKLOG.md](WORKLOG.md) · 세션 기록: [04-review/history/](04-review/history/)

---

## 운영 정보

- **배포**: [DEPLOY.md](DEPLOY.md) (CLI 원커맨드 절차)
- **프로덕션**: https://tester-match.pages.dev
- **관리자 계정**: choirj91@gmail.com (role=admin), 940번 계정
- **Supabase**: 마이그레이션 `03-output/supabase/migrations/` → `npx supabase db push` (03-output에서)
- **광고 브랜치**: `feat/adsense-placements` (승인 시 병합)

## KPI 게이트 (기존 유지)

| 단계 | 지표 | 목표 |
|---|---|---|
| Launch | 등록 앱 수 | 100건 |
| Operational | 매칭 성공률 | 80% 이상 |
| Monetization | Boost 첫 결제 | 1건 |
| Scale | MAU / 월 결제 | 1,500 / 25건 |

---

## 다음 작업자에게

1. 컨텍스트 회복 순서: [README.md](README.md) → [NEXT.md](NEXT.md)(이 문서) → [WORKLOG.md](WORKLOG.md) 최근 3일 → [01-source/decisions/](01-source/decisions/)
2. 잠금 결정 충돌 시 **코드 전에 ADR 추가** (`01-source/decisions/ADR-NNNN-*.md`)
3. 세션 종료 시: WORKLOG.md 오늘 항목 + NEXT.md 할일 갱신 + 큰 결정은 04-review/history/에 세션 기록
4. 배포는 반드시 [DEPLOY.md](DEPLOY.md) 절차 — cwd 틀리면 이전 빌드가 배포되는 사고 이력 있음
