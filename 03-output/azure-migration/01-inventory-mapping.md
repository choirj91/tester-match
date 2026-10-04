# 01 — 현재 구성 요소 대장과 Azure 대응

- 작성: 2026-10-04 · 기준 커밋 `8f942d3` (`feat/seat-escrow`, origin/main 과 동일 — 운영 배포 상태와 일치) [검증]
- 작업 트리: 추적 파일 변경 없음. 미추적 5개(`AGENTS.md`, `cc.html`, `gp.html`, `gpd.html`, 이 프롬프트 파일) — 이전과 무관 [검증]
- 확신 표시: `[검증]` 코드·DB·실행으로 확인 / `[문서]` 문서로만 확인 / `[추정]` 정황 판단

## 1. 운영 규모 (2026-10-04 읽기 전용 집계)

| 항목 | 값 | 근거 |
|---|---|---|
| DB 크기 | 33 MB | `pg_database_size` [검증] |
| 로그인 계정 (`auth.users`) | 약 790 — 이메일 가입은 한 자릿수, 나머지 Google | `auth.identities` provider 별 집계 [검증] |
| 회원 행 (`public.users`) | 약 1,300 (사전등록 행 포함) | [검증] |
| 최근 30일 접속 회원 | 약 260 | `users.last_seen_at` [검증] |
| 앱 / 매칭 / 체크인 | 1,000+ / 약 2,100 / 약 4,700 | [검증] |
| 크레딧 원장 / 결제 / 유료 주문 | 각각 수십 건 미만 | [검증] |
| 스토리지 | 버킷 1개(`paid-order-screenshots`, 비공개), 객체 0개 | `storage.objects` [검증] |
| Supabase 리전 | Northeast Asia (Tokyo) | `supabase projects list` [검증] |

→ 데이터 이전량은 사실상 무시할 수준이다. 이전 난이도는 데이터가 아니라 **코드 결합**에서 나온다.

## 2. 구성 요소 대장과 판정

> 2026-10-04 결정(ADR-0015): 판정과 무관하게 **인프라 요소는 전부 Azure 로** 옮긴다. 판정은 검토 당시 분석 기록.

판정: **A** = 옮길 수 있고 옮길 가치 있음 · **B** = 옮길 수 있지만 얻는 것 적음 · **C** = Azure 밖에 남음

| # | 요소 | 현재 | 코드 결합 | Azure 대응 후보 | 판정 |
|---|---|---|---|---|---|
| 1 | 웹 호스팅·SSR | Cloudflare Pages + `@cloudflare/next-on-pages` (Next 15.1.3, 전 페이지 edge) | 92개 파일 `export const runtime = "edge"`, Cloudflare API 직접 호출 4곳 | App Service Linux (B1) / Container Apps | **A** |
| 2 | DB | Supabase Postgres 15 (도쿄) | 순수 Postgres — 확장 `citext`·`pgcrypto` 뿐, `pg_cron`·`pg_net` 없음 | Azure Database for PostgreSQL Flexible Server (Korea Central) | **A** (2단계) |
| 3 | 데이터 접근 계층 | supabase-js → PostgREST(HTTP) | 약 80개 파일, `.from()` 약 320곳, `.rpc()` 6곳, FK 임베드 ~14곳 | 쿼리 빌더(Drizzle/Kysely) 재작성 또는 PostgREST 자체 운영 | **A** (2단계, 최대 작업량) |
| 4 | 인증 | Supabase Auth (Google OAuth + 이메일/비밀번호, 자체 인증 메일) | 약 12개 파일 + `auth.users` 트리거 2개 + SD 함수 5개 | Auth.js v5 (자체 Postgres) / Entra External ID | **A** (2단계, 최대 위험) |
| 5 | 파일 저장소 | Supabase Storage 1 버킷, 1시간 서명 URL | 4개 파일 | Blob Storage + SAS | **A** (2단계, 객체 0개) |
| 6 | 행 수준 보안(RLS) | 정책 32개 | 서버는 service-role 로 RLS 우회, 권한 검사는 앱 코드 (`lib/auth.ts` 주석) | 불필요 — 앱 권한 검사 유지 | **B** |
| 7 | 스케줄 작업 | GitHub Actions cron 7종 → `POST /api/cron/*` (Bearer `CRON_SECRET`) | URL 하드코딩 1곳(`cron.yml`) | Functions 타이머 / Container Apps Jobs | **A** — 현재 3~6시간 지연 문제 해소 |
| 8 | 메일 발송 | Resend (`noreply@knockknock.company`, 도메인 검증 완료) | `lib/email.ts` 1곳 | Azure Communication Services Email | **A (3단계)** — 기본 한도 시간당 100통, 증액 신청 후 전환. 도메인 메일 **수신**은 Google Workspace(Gmail)라 Azure 밖에 그대로 |
| 9 | 결제 | 토스페이먼츠 (confirm API·주문 조회, 웹훅 없음) | `lib/toss.ts`, 체크아웃 위젯 | — | **C** |
| 10 | Google OAuth | Google Cloud OAuth 클라이언트 → Supabase 콜백 | Supabase 대시보드 설정 | 인증 교체 시 리다이렉트 URI 변경 | **C** (설정만 변경) |
| 11 | Google Workspace Directory API | 서비스 계정 + domain-wide delegation | `lib/google-groups.ts` 등 4곳 | — | **C** |
| 12 | 도메인·DNS (3단계 → Azure DNS, 판정 A) | `tester-match.knockknock.company` — 네임서버 Cloudflare(프록시 켬), 등록기관 GoDaddy [문서: 운영자 지식 베이스 인프라 노트] | 소스 13곳 하드코딩 (도메인 유지 시 무변경) | Azure DNS (선택) | **B** — 레코드만 변경 |
| 13 | 비밀 관리 | Cloudflare Pages 시크릿 + 로컬 `.env.local` + GitHub Secrets | `NEXT_PUBLIC_*` 는 빌드 타임 주입 | Key Vault + App Service 앱 설정 참조 | **A** |
| 14 | 로그·모니터링 | **없음** (Sentry·PostHog 는 `.env.example` 에만) | — | Application Insights + Log Analytics | **A** — 현재 공백 해소 |
| 15 | WAF·DDoS·CDN | Cloudflare 무료 | 없음 | Front Door Standard $35/월 | **B** — 시작은 App Service 기본 플랫폼 보호, 필요 시 Front Door |
| 16 | 메신저 | 카카오톡 오픈채팅 정적 링크 | 상수만 | — | **C** |
| 17 | 콘텐츠 자동화 | 코드에 없음 | — | — | 해당 없음 |
| 18a | 루트 홈페이지 | Cloudflare Pages `knockknock-homepage` (정적 export, 별도 리포) [문서] | 없음 | Static Web Apps Free | **B** — 별도 판단, 이 계획 범위 밖 |
| 18 | CI | GitHub Actions `ci.yml` (lint·tsc·vitest·build) | — | 유지 + 배포 잡 추가 (OIDC) | **B** |

출처: 런타임·연동 조사 (`03-output/app/package.json`, `wrangler.toml`, `src/lib/wait-until.ts`, `src/lib/auth.ts:77-80`, `src/app/api/waitlist/route.ts:32`, `src/lib/signup-guard.ts:22`, `.github/workflows/cron.yml`), Supabase 결합 조사 (`src/lib/supabase/*`, `03-output/supabase/migrations/` 43개).

## 3. 결합 근거 상세

### 3.1 런타임 결합 (Cloudflare edge) — 1단계 범위

| 변경 | 파일 수 | 종류 |
|---|---|---|
| `export const runtime = "edge"` 삭제 | 92 | 기계적 (한 줄 삭제) [검증] |
| `getRequestContext().ctx.waitUntil` → Next `after()` 또는 await | 2 (`lib/wait-until.ts`, `lib/auth.ts`) — 호출부 3곳은 그대로 | 동작 변경 [검증] |
| `cf-connecting-ip` → App Service 의 클라이언트 IP 헤더 | 2 (`api/waitlist`, `lib/signup-guard.ts`) | 보안 관련 — 가입 남용 제한이 IP 기준 [검증] |
| `next.config.ts` 에 `output: "standalone"` | 1 | 설정 |
| `package.json` 스크립트·의존성 (`@cloudflare/*`, `wrangler` 제거) | 1 | 설정 |
| `wrangler.toml` 삭제, `middleware.ts` 의 pages.dev 리다이렉트 정리 | 2 | 정리 |
| 배포 워크플로우 신설 | 1 (`.github/workflows/deploy.yml`) | 신규 |
| 합계 | **약 100개 파일, 95% 기계적** | |

동작이 달라지는 지점:
- **응답 후 작업**: Cloudflare 는 `waitUntil` 로 보장. Node 에서는 인스턴스 재시작 시 끊길 수 있다 — 최초 로그인 시 Workspace 그룹 가입, 체크인 후 부가 작업이 해당. `after()`(Next 15.1 안정화 [추정 — 1단계 PoC 에서 확인]) 또는 await 로 바꾼다.
- **CPU 제한 해제**: 크론이 `"more": true` 로 여러 번 호출하는 이유였던 요청당 CPU 제한이 사라진다. 반복 호출 구조는 그대로 둬도 무해.
- **본문 크기**: 체크인 스크린샷은 라우트가 자체적으로 6 MB 상한 (`checkins/route.ts:23`) — App Service 기본 한도 이내 [추정].
- `crypto.subtle`·`atob` 사용 코드(`lib/toss.ts`, `google-groups.ts`, `signup-confirm.ts`)는 Node 20 전역 Web Crypto 로 동작 [추정 — 단위 테스트로 확인].

### 3.2 관리형 백엔드 결합 (Supabase) — 2단계 범위

| 결합 | 규모 | 비고 |
|---|---|---|
| service-role 관리자 클라이언트 | 75개 파일 | 사실상 "HTTP 로 SQL 을 보내는 통로" |
| 쿠키 세션 클라이언트 | 4개 파일 + 미들웨어 | `@supabase/ssr` |
| 브라우저 클라이언트 | 2개 파일 | 로그인 폼, Google 버튼 |
| `.from()` 체인 | 약 320곳 (`Buffer.from` 등 제외) / 쿼리 대상 21개 테이블 (스키마 전체는 27개) | 상위: `paid_tester_orders` 53, `matches` 52, `apps` 49, `users` 36, `seat_rewards` 23 |
| `.rpc()` | 6곳 | `ledger_append`, `order_add_refund_due`, `create_email_member`, `ensure_member_row`, `increment_post_view`×2 |
| FK 임베드 | ~14곳 | SQL 조인으로 변환. PGRST201 사고 이력 (힌트 필수) |
| Auth API | `getUser`×5, `signInWithOAuth`, `signInWithPassword`, `exchangeCodeForSession`, `verifyOtp`, admin `createUser`·`generateLink`·`deleteUser`×2·`updateUserById`×2·`signOut`×2 | 이메일 가입은 서버 생성 + 자체 인증 메일 |
| `auth.users` 트리거 | `on_auth_user_created`, `on_auth_user_email_confirmed` → `handle_new_auth_user` | 사전등록 행 연결 규칙 (ADR-0013 보강) |
| Supabase 역할 참조 | `authenticated` 39줄, `anon` 11줄, `service_role` 25줄 | GRANT·정책. 대부분 삭제 가능 |
| 마이그레이션 재작성 | 약 7개 | auth 트리거·연결 함수·RLS·GRANT |

돈 관련 불변식(원장 append-only 트리거, 부분 unique 7개, `order_code`·`provider_tx_id` unique, `(match_id, day_n)` unique)은 **순수 Postgres** 라 그대로 옮겨진다 [검증].

### 3.3 14일 일차 계산

`lib/checkin.ts` `currentDayN` 은 옵트인 시각(`timestamptz`)부터 24시간 단위로 센다 — 달력 날짜가 아니다 [검증]. 따라서 DB 를 옮겨도 `timestamptz` 값이 보존되면 일차는 변하지 않는다. KST 처리는 앱 코드 약 20곳과 SQL 1곳(`20260725000001_page_views_kst.sql`)에 있으며 서버 시간대에 의존하지 않도록 명시 변환을 쓴다. 단, **App Service 의 `TZ` 는 UTC 로 둔다** (변경 시 숨은 `new Date()` 해석이 달라질 위험 [추정]).

## 4. 문서 불일치 (이전 작업 중 발견)

| 문서 | 내용 | 실제 |
|---|---|---|
| `DEPLOY.md` | `cd` 경로가 옛 폴더 | 현재 리포 경로와 다름 [검증] |
| `03-output/infra/cloudflare-pages.md` | 환경변수 `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 코드는 `…_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` [검증] |
| `03-output/infra/supabase-auth-setup.md` | 리다이렉트 URL 에 `testermatch.com` | 운영 도메인은 `tester-match.knockknock.company` [검증] |
| ADR-0002 | "백그라운드 잡: Cloudflare Cron Triggers" | 실제는 GitHub Actions [검증] |
| ADR-0002 | "이메일: Resend + Brevo 자동 라우팅" | Brevo 미구현 [검증] |
| ADR-0004 | "RLS 로 백엔드 코드 절감" | 서버는 RLS 우회, 권한은 앱 코드 [검증] |
