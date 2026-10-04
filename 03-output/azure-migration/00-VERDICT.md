# 00 — 결론: Tester Match 전 인프라 Azure 이전

- 최초 작성: 2026-10-04 (검토 단계) · **결정 갱신: 2026-10-04 — 사용자 결정으로 전부 이전, 최소 사양**
- 결정 문서: [ADR-0015 (Accepted)](../../01-source/decisions/ADR-0015-azure-migration.md)

## 결정

**기존 무료 인프라를 모두 Azure 로 옮긴다.** 무료 한도에 맞추는 운영은 끝낸다. 다만 수익이 없으므로 **가장 작은 유료 사양에서 시작하고, 코드 변경 없이 SKU 만 바꿔 확장**한다.

검토 단계의 권고(1단계만 먼저, DB·인증은 조건부)는 창업자 결정으로 대체됐다. 1단계를 먼저 하는 **순서**는 유지한다 — 되돌리기 쉬운 것부터 옮기고, 앱이 Node 런타임에서 안정된 뒤 DB·인증을 옮긴다.

## 무엇이 어디로

| 현재 (무료) | Azure | 단계 |
|---|---|---|
| Cloudflare Pages | App Service B1 | 1 |
| GitHub Actions cron | Functions 타이머 | 1 |
| (없음) | Application Insights · Log Analytics · Key Vault | 1 (완료) |
| Supabase Postgres (도쿄) | PostgreSQL Flexible B1ms (서울) | 2 |
| Supabase Auth | Auth.js on PostgreSQL | 2 |
| Supabase Storage | Blob Storage | 2 |
| Resend | ACS Email | 3 |
| Cloudflare DNS | Azure DNS | 3 |

Azure 밖에 남는 외부 서비스: 토스페이먼츠, Google(OAuth·Workspace 도메인 메일·Directory API·테스터 그룹), 카카오 오픈채팅, GitHub, GoDaddy(등록기관).

## Supabase → PostgreSQL

DB 는 이미 PostgreSQL 이라 데이터 이전은 쉽다 (33 MB, 확장 `citext`·`pgcrypto`). 작업량은 Supabase 가 얹어 준 계층을 다시 만드는 데서 나온다 — 데이터 접근 약 80개 파일·약 320곳, 인증 약 12개 파일, 스토리지 4개 파일. Supabase 를 Azure 위에 셀프호스팅하지 않는다 (관리형 PostgreSQL 에 superuser·`pg_net` 없음).

## 숫자

| | 값 |
|---|---|
| 시작 구성 월 비용 | **약 $45** (≈6.3만원) — [04-cost.md](04-cost.md) |
| 크레딧 ($5,000 이하) | 기간 내 실청구 없음. 만료 후 자동 종량제 → 월 약 $45 |
| 기간 | 1단계 5~8일 · 2단계 20~30일 · 3단계 3~5일 (+ 단계별 병행 운영) |
| 점검 시간 | 1·3단계 없음(DNS 전환) · 2단계 약 60분 |
| 확장 경로 | App Service B1→B2/P0v3·인스턴스 1→3 / PostgreSQL B1ms→B2s→범용 D2ds(+HA) / Front Door 추가 |

## 진행 상황

[05-migration-plan.md](05-migration-plan.md) 끝의 진행 기록 참조. 2026-10-04 기준: 1-1 기반 리소스 완료, 1-2 코드 변경 완료(브랜치 `feat/azure-hosting`, 미커밋).

## 문서 안내

| 파일 | 내용 |
|---|---|
| [01-inventory-mapping.md](01-inventory-mapping.md) | 구성 요소 대장·판정, 코드 결합 근거 |
| [02-options.md](02-options.md) | 검토한 선택지 비교 (결정 전 분석, 기록용) |
| [03-target-architecture.md](03-target-architecture.md) | 목표 구성, 리소스 이름·태그, 비밀·관측성, 확장 경로 |
| [04-cost.md](04-cost.md) | 시작 구성 비용, 확장 시 비용, 예산 알림 |
| [05-migration-plan.md](05-migration-plan.md) | 단계별 계획·전환 순서·대조 쿼리·롤백·진행 기록 |
| [06-isolation-runbook.md](06-isolation-runbook.md) | 회사 Azure 와의 격리 절차 |
| [07-risks.md](07-risks.md) | 위험 대장 |
| [08-founder-questions.md](08-founder-questions.md) | 남은 질문 |
