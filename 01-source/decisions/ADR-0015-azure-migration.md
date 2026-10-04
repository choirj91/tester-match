# ADR-0015: 전 인프라 Azure 이전 — 최소 사양으로 시작, 확장 가능하게 (ADR-0002 대체)

- **상태**: Accepted (2026-10-04, 사용자 결정)
- **결정자**: nakjun
- **관련**: ADR-0002 (호스팅 — 잠금 결정 #2, 본 ADR 이 **대체**), ADR-0004·0013 (인증 — 구현 기반 교체), ADR-0012·0014 (유료 시트 — 전환 중 보호 대상)
- **상세**: `03-output/azure-migration/` (00-VERDICT ~ 08)
- **개정 이력**: 같은 날 "1단계만 채택, 2단계 조건부" 제안으로 작성 → 사용자 결정으로 "전부 이전, 최소 사양" 으로 확정

## Context

- Microsoft for Startups 스폰서십 구독(크레딧 $5,000 이하)을 받았다. 창업자 지시: **무료 한도 안에서 버티는 운영을 끝내고, 기존 무료 인프라를 모두 Azure 로 옮긴다.** 단 수익이 없으므로 **사양은 최소로, 확장은 가능하게.**
- ADR-0002 는 "고정비 0원" 을 위해 Cloudflare Pages + Supabase Free 를 택했다. 운영해 보니 무료 구성의 대가가 드러났다:
  - edge 런타임 CPU 제한 때문에 크론을 쪼개 반복 호출해야 했다.
  - 크론은 GitHub Actions 로 돌며 3~14시간 지연됐다 (리마인더가 새벽 도착).
  - 관측성이 없어 사고를 원장 대조로만 발견했다.
  - Supabase 는 도쿄 리전, PostgREST 1,000행 제한·임베드 모호성(PGRST201) 사고가 반복됐다.
- 규모: DB 33 MB, 로그인 계정 약 790, 30일 활성 약 260. 급증은 예상하지 않는다.

## Decision

1. **Azure 로 옮기는 것** (리소스 그룹 `rg-testermatch-prod-krc`, Korea Central):

   | 현재 | Azure | 시작 사양 |
   |---|---|---|
   | Cloudflare Pages (edge) | App Service Linux (Node 20, standalone) | B1 |
   | GitHub Actions cron | Functions Flex Consumption 타이머 | 종량 |
   | Supabase Postgres | Azure Database for PostgreSQL Flexible | Burstable B1ms, 32 GB, 백업 7일 |
   | Supabase Auth | Auth.js v5 (Google + 이메일/비밀번호) on PostgreSQL | — |
   | Supabase Storage | Blob Storage (Hot LRS, SAS) | — |
   | supabase-js / PostgREST | 쿼리 빌더(Drizzle) + `pg` | — |
   | Resend | Azure Communication Services Email | 발송 한도 증액 신청 |
   | Cloudflare DNS | Azure DNS (공개 영역 `knockknock.company`) | — |
   | (없음) 관측성 | Application Insights + Log Analytics | — |
   | Cloudflare/로컬 시크릿 | Key Vault | Standard |

2. **Azure 밖에 남는 것** (인프라가 아니라 외부 서비스): 토스페이먼츠, Google OAuth·Workspace(도메인 Gmail·Directory API·테스터 그룹), 카카오 오픈채팅, GitHub(코드·CI), 도메인 등록기관(GoDaddy).
3. **최소 사양 원칙**: 처음엔 가장 작은 유료 SKU. 확장은 코드 변경 없이 SKU 변경으로 한다 (App Service B1→B2/P0v3·인스턴스 1→3, PostgreSQL B1ms→B2s→범용 D2ds + 영역 중복 HA, 필요 시 Front Door). 사양을 올릴 때는 예산 알림 금액을 같이 올린다.
4. **넣지 않는 것 (지금)**: Front Door(월 $35 — WAF·CDN 이 필요해지면), PostgreSQL HA, App Service 다중 인스턴스 상시 운영.
5. **순서**: 1단계 호스팅·크론·관측 → 2단계 DB·인증·스토리지 → 3단계 메일 발송·DNS → Cloudflare Pages·Supabase·Resend 해지. 각 전환은 승인 게이트와 롤백 절차를 따른다 (`05-migration-plan.md`).
6. Azure 작업은 회사(직장) Azure 와 분리된 설정·래퍼(`05-harness/scripts/tm-az`)·전용 리소스 그룹에서만 한다 (`06-isolation-runbook.md`).

## Why

- 창업자 결정 — 무료 한도 회피에 쓰던 설계·운영 비용을 없애고 한 클라우드에서 관리한다.
- 최소 사양 구성은 월 약 $45 로, $5,000 이하 크레딧 기간 동안 실청구가 없고 만료 후에도 감당 가능한 수준이다.
- 데이터가 서울로 오면서 DB 왕복 지연이 줄고(도쿄→서울), 크론 정시성·관측성·PostgREST 제약 문제가 함께 해소된다.

## Consequences

- 잠금 결정 #2 를 "Azure (App Service + PostgreSQL Flexible + Functions + Blob + ACS + Azure DNS)" 로 갱신하고, `CLAUDE.md` 작성 원칙 "무료 우선" 을 "최소 사양 + 확장 가능" 으로 바꾼다. `01-source/spec/08_tech_stack.md` 의 무료 티어 분석은 역사 기록으로 남는다 (원천 수정 금지).
- 데이터 접근(약 80개 파일·약 320곳)·인증(약 12개 파일)·스토리지(4개 파일)·메일(1개 파일)을 다시 쓴다. 인증 재작성은 ADR-0013 보강 7항목을 요구사항으로 고정하고 보안 리뷰를 거친다.
- Cloudflare 무료 WAF·DDoS 보호가 사라진다. App Service 기본 플랫폼 보호로 시작하고, 공격 징후가 있으면 Front Door 를 추가한다.
- ACS Email 기본 한도(시간당 100통)는 리마인더 일괄 발송에 부족할 수 있어 3단계 전 증액을 신청한다.
- 크레딧 만료 후 월 약 $45 (약 6.3만원)가 청구된다 (자동 종량제 전환).
- 배포 절차가 GitHub Actions OIDC 배포로 바뀐다 → `DEPLOY.md`·`tm-deploy` 스킬 갱신.
