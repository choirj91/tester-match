# 03 — 목표 구성

- 작성: 2026-10-04 · **갱신: 전 인프라 Azure, 최소 사양 + 확장 가능 (ADR-0015 Accepted)**. 1단계 → 2단계 → 3단계 순서
- 지역: **Korea Central (서울)** 단일. Korea South 는 페어 리전(재해 복구)으로만 고려

## 1. 1단계 목표 구성

```
사용자 (한국)
   │ HTTPS  tester-match.knockknock.company
   ▼
Cloudflare DNS (레코드만 변경, 프록시 여부는 §5)
   │
   ▼
App Service  app-testermatch-prod-krc   ← Next.js 15 standalone, Node 20, TZ=UTC
   │  ├─ 앱 설정 → Key Vault 참조 (kv-testermatch-prod-krc)
   │  └─ 로그·추적 → Application Insights (appi-testermatch-prod) → Log Analytics
   │
   ├──▶ Supabase (도쿄)  DB · Auth · Storage   ← 그대로
   ├──▶ Resend            인증·알림 메일         ← 그대로
   ├──▶ 토스페이먼츠       confirm·주문 조회      ← 그대로 (웹훅 없음)
   └──▶ Google APIs       OAuth(Supabase 경유)·Directory API

Functions  func-testermatch-prod-krc (Flex Consumption, 타이머 7개)
   └─ POST https://tester-match.knockknock.company/api/cron/*  (Bearer CRON_SECRET)
GitHub Actions
   ├─ ci.yml (그대로)
   └─ deploy.yml (신규, OIDC → App Service 배포)   ← cron.yml 은 병행 기간 뒤 비활성
```

## 2. 2단계 목표 구성 — DB·인증·스토리지

```
App Service ──▶ PostgreSQL Flexible  psql-testermatch-prod-krc (B1ms, 32 GB, 백업 7일)
           │      ├─ schema public   (현 스키마, RLS 정책·Supabase 역할 GRANT 제거)
           │      └─ schema app_auth (Auth.js: users·accounts·verification_tokens + 이전된 bcrypt 해시)
           ├──▶ Blob  sttestermatchprod / container paid-order-screenshots (비공개, 사용자 위임 SAS 1h)
           └──▶ Resend · 토스 · Google (그대로, Google OAuth 리다이렉트 URI 만 추가)
```

## 2-1. 3단계 최종 구성 — 메일 발송·DNS (Cloudflare·Supabase·Resend 해지 후)

```
사용자 ─▶ Azure DNS (knockknock.company 영역, 네임서버 GoDaddy 에서 Azure 로 변경)
            │  tester-match CNAME → App Service (관리형 인증서)
            │  MX·SPF·DKIM(Google Workspace 메일) ← 그대로 복사, 도메인 Gmail 수신 유지
            │  ACS Email 도메인 인증 레코드 (SPF include·DKIM 2개)
            │  홈페이지 레코드 (knockknock-homepage 세션 소유 — 협의 후 복사)
            ▼
App Service B1 ──▶ PostgreSQL B1ms · Blob · Key Vault · App Insights
           └──▶ ACS Email  noreply@knockknock.company (발송 한도 증액 신청 후)
Functions 타이머 7개 ──▶ App Service /api/cron/*
외부: 토스 · Google(OAuth·Workspace·Directory API) · 카카오
```

## 2-2. 확장 경로 (코드 변경 없이 SKU 만)

App Service B1 → B2 → P0v3(슬롯·자동 확장) · 인스턴스 1→3 / PostgreSQL B1ms → B2s → 범용 D2ds + 영역 중복 HA / 앞단 WAF·CDN 이 필요하면 Front Door Standard. 비용은 [04-cost.md](04-cost.md) §2.

DB 접속: App Service → PostgreSQL 은 공용 엔드포인트 + 방화벽(App Service 아웃바운드 IP만) [추정 — 비용 0]. VNet 통합·Private Endpoint 는 Private DNS·엔드포인트 비용이 붙으므로 확장 단계에서 검토.

## 3. 리소스 목록과 이름·태그 규칙

이름 규칙: `<종류약어>-testermatch-<env>-<지역약어>` (Cloud Adoption Framework 약어). 스토리지·Key Vault 는 글자 제한으로 지역 생략.

| 리소스 | 이름 | 단계 | SKU |
|---|---|---|---|
| 리소스 그룹 | `rg-testermatch-prod-krc` | 0 | — |
| 예산 | `budget-testermatch-monthly`, `budget-testermatch-guard` | 0 | — |
| Log Analytics | `log-testermatch-prod-krc` | 1 | 종량 (5 GB 무료) |
| Application Insights | `appi-testermatch-prod-krc` | 1 | 작업영역 기반 |
| Key Vault | `kv-testermatch-prod-krc` | 1 | Standard, RBAC 모드 |
| App Service Plan | `asp-testermatch-prod-krc` | 1 | Linux B1 |
| App Service | `app-testermatch-prod-krc` | 1 | 시스템 할당 관리 ID |
| Functions | `func-testermatch-prod-krc` (+ 저장소 `stfunctestermatch`) | 1 | Flex Consumption |
| 배포용 앱 등록 | `sp-testermatch-deploy` (대상 테넌트, GitHub OIDC 페더레이션) | 1 | — |
| PostgreSQL | `psql-testermatch-prod-krc` | 2 | Burstable B1ms |
| 스토리지 | `sttestermatchprod` | 2 | StorageV2 Hot LRS |
| 스테이징 PostgreSQL | `psql-testermatch-stg-krc` (리허설 후 삭제) | 2 | B1ms |
| Communication Services + Email | `acs-testermatch-prod` + 이메일 도메인 `knockknock.company` (데이터 위치 Korea) | 3 | 종량 |
| DNS 영역 | `knockknock.company` (공개, 위치 global) — **공용 그룹 `rg-knockknock-shared`** (홈페이지와 공유, 두 래퍼 모두 범위 밖 → 생성·레코드 변경은 사용자 승인 하에 공용 래퍼 또는 포털) | 3 | — |

공통 태그 (모든 리소스 필수):

| 태그 | 값 |
|---|---|
| `project` | `tester-match` |
| `owner` | `knockknock-company` |
| `env` | `prod` / `stg` |
| `managed-by` | `tm-az` (격리 래퍼, [06-isolation-runbook.md](06-isolation-runbook.md)) |
| `cost-center` | `azure-credit` |

리소스 그룹에 Azure Policy 2개 할당 (2026-10-04 적용): "허용 위치 = koreacentral" (DNS 영역·ACS 처럼 위치가 global 인 리소스는 내장 정책이 허용), "태그 `project` 필수". 실수로 다른 지역·태그 없이 만드는 것을 생성 시점에 막는다.

## 4. 비밀 관리

| 비밀 (이름만) | 1단계 위치 | 비고 |
|---|---|---|
| `SUPABASE_SECRET_KEY`(2단계에서 제거), `RESEND_API_KEY`(3단계에서 ACS 연결 문자열로 교체), `TOSS_SECRET_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET` | Key Vault → App Service 앱 설정 `@Microsoft.KeyVault(...)` 참조 | App Service 관리 ID 에 `Key Vault Secrets User` |
| `CRON_SECRET` | Key Vault → Functions 앱 설정 참조 | 같은 값 |
| `NEXT_PUBLIC_*` (Supabase URL·publishable key·토스 클라이언트 키·앱 URL·가입 플래그) | GitHub Actions 빌드 변수 (비밀 아님) | **빌드 타임 주입** — 바꾸면 재빌드 필요 (현행과 동일한 함정) |
| `SLACK_INQUIRY_WEBHOOK_URL` (문의 기능, 2026-10-04 추가 — 없으면 Slack 전송만 생략) | Key Vault → App Service 앱 설정 참조 | 비밀 |
| `ADMIN_NOTIFY_EMAIL`, `PAID_TESTERS_ORDER_ALLOWLIST`, `GOOGLE_ADMIN_EMAIL`, `TESTER_GROUP_*` | App Service 일반 앱 설정 | |
| 2단계: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Key Vault | Google OAuth 비밀은 지금 Supabase 대시보드에 있음 → Google Cloud 콘솔에서 재발급 |
| 배포 자격 | GitHub Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | 리포는 **공개** — 이 값들은 파일에 쓰지 않고 Secrets 에만 |

## 5. 네트워크·도메인

- 도메인 유지: `tester-match.knockknock.company`. 하드코딩 13곳·토스 성공/실패 URL·Supabase 리다이렉트 허용 목록이 **변경 불필요**해진다.
- DNS: `tester-match` CNAME → `app-testermatch-prod-krc.azurewebsites.net` + 소유 확인 TXT `asuid.tester-match`. App Service 무료 관리형 인증서 사용 [문서: https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-certificate].
- Cloudflare 프록시: 1단계 전환 때 **DNS 전용(회색)** 으로 끈다 (관리형 인증서 발급 문제 [추정]). 3단계에서 DNS 자체가 Azure DNS 로 옮겨 Cloudflare 는 완전히 빠진다. WAF·DDoS 는 App Service 기본 플랫폼 보호로 시작, 필요 시 Front Door.
- `tester-match.pages.dev` 308 리다이렉트: Pages 프로젝트를 병행 기간 동안 유지하므로 그대로 동작. Pages 해지 시 소멸 (외부 링크 영향은 검색 색인 정도 [추정]).

## 6. 관측성

| 대상 | 방법 | 경보 |
|---|---|---|
| 요청·예외·의존성(Supabase·토스·Resend HTTP) | Application Insights Node SDK (OpenTelemetry 배포판) | 5분간 5xx ≥ 5건 → 메일 |
| 크론 | Functions 실행 로그 + 응답 코드 | 실패 1회 → 메일 (지금은 GitHub 실패 메일뿐, gh 토큰 만료로 열람 불가 이력) |
| 가용성 | App Insights 표준 가용성 테스트 `/` 5분 간격 | 2개 지역 연속 실패 → 메일 |
| 비용 | 예산 알림 (§04-cost) | |
| 개인정보 | 로그에 이메일·전화 미기록 — 요청 본문 수집 끔, 사용자 ID 만 | CLAUDE.md "마스킹 없는 로그 전송 금지" |

일일 수집 상한(cap)은 폭주 방지용 안전장치로 0.5 GB 에서 시작 (현재 설정). 무료 한도를 맞추려는 값이 아니므로, 로그가 잘리기 시작하면(cap 도달 알림) 1~2 GB 로 올린다.
