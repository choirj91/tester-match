# 05 — 단계별 이전 계획

- 작성: 2026-10-04 · 기준 커밋 `8f942d3` · **갱신: 전 인프라 이전 확정 (ADR-0015 Accepted) — 2단계 필수, 3단계(메일·DNS) 추가**
- 모든 Azure 명령은 [06-isolation-runbook.md](06-isolation-runbook.md) 의 `tm-az` 래퍼로만. 변경 명령 직전 **[사전 점검]** 블록 출력 필수
- 🔒 = 사용자 명시 승인 게이트 (한 번의 승인은 그 단계에만 유효)

## 0단계 — 준비 (Azure 리소스 생성 없음)

| | 내용 |
|---|---|
| 목표 | 대상 구독 확정, 격리 설정 완성, 서비스 안정화 |
| 선행 | 토스 라이브 전환 ①~⑥ 완료 (`NEXT.md`) + 그 뒤 2주 무사고 |
| 작업 | (완료 2026-10-04) ① 창업자 질문 답변 수령 ([08](08-founder-questions.md)) ② 대상·로그인은 홈페이지와 공유 — `kh-az login` 이 돼 있으면 추가 로그인 불필요 ([06](06-isolation-runbook.md) §1) ③ `05-harness/scripts/tm-az account show` 로 테넌트·구독 일치 확인 + `tm-az appservice list-locations --sku B1` 로 스폰서십 구독의 Korea Central 제공 여부 확인 ④ 기준 커밋 정리 — 작업 트리 깨끗, 운영 배포 커밋 = main HEAD ⑤ ADR-0015 승인 |
| 검증 | 래퍼가 불일치 시 종료 코드 2 로 멈추는지 시험 (틀린 구독 ID 로 한 번) |
| 🔒 게이트 | ADR-0015 승인 ✅, 대상 4종 확정 ✅ (홈페이지와 공유) |
| 롤백 | 해당 없음 |

## 1단계 — 호스팅·크론·관측 이전 (Supabase 유지)

### 1-1. 과금 안전장치와 기반 리소스

| | 내용 |
|---|---|
| 작업 | 리소스 그룹 → Policy 2개(허용 위치·태그 필수) → **예산 2개** → Log Analytics·App Insights → Key Vault |
| 검증 | `tm-az resource list -g rg-testermatch-prod-krc -o table` 에 의도한 것만. 예산 알림 시험 메일 수신 |
| 🔒 | 리소스 생성 |
| 롤백 | `tm-az group delete -n rg-testermatch-prod-krc` (이 그룹만, 이 작업이 만든 것만 들어 있음) |

### 1-2. 코드 변경 (브랜치 `feat/azure-hosting`, 운영 무영향)

1. 병합 전 태그 `pre-azure-cloudflare` — Cloudflare 빌드 경로 보존 (되돌아가기 대비)
2. `runtime = "edge"` 92곳 삭제
3. `lib/wait-until.ts`·`lib/auth.ts` → Next `after()` (Next 15.1 에서 안정 API 인지 PoC 로 확인 [추정]), 안 되면 await
4. 클라이언트 IP: `cf-connecting-ip` → 헬퍼 `getClientIp()` 하나로 모으고 App Service 헤더 사용. **위조 가능한 첫 번째 X-Forwarded-For 값 금지** — App Service 프런트엔드가 덧붙인 값 기준 [추정, PoC 에서 헤더 실측]
5. `next.config.ts` `output: "standalone"`, `package.json` 스크립트, `@cloudflare/*`·`wrangler` 제거
6. `.github/workflows/deploy.yml` — `azure/login` OIDC(대상 테넌트·구독 명시) → standalone 빌드 → App Service zip 배포. `NEXT_PUBLIC_*` 은 빌드 변수
7. Functions 프로젝트 (타이머 7개, 각 HTTP POST + 재시도 + 실패 시 비정상 종료) — 스케줄은 `cron.yml` 과 동일 UTC
8. 테스트: tsc·vitest·eslint·`next build`. 신규 테스트 — IP 헬퍼, `after()` 경로, KST 경계 테스트 재실행(`TZ=UTC`·`TZ=Asia/Seoul` 두 번)

| 검증 | 로컬 `next start` 로 주요 페이지·API 스모크. **로컬 env 는 운영 DB 를 가리키므로 크론 라우트 호출 금지** (리마인더·페널티 실발송 위험) |
| 🔒 | 없음 (코드만) — 단 공유 작업 트리이므로 **별도 worktree** 에서 작업 |

### 1-3. 스테이징 배포와 병행 운영

| | 내용 |
|---|---|
| 작업 | App Service Plan B1 + App Service 생성 → 배포 → 기본 주소 `*.azurewebsites.net` 에서 확인 |
| 주의 | 스테이징 주소도 **운영 Supabase** 를 쓴다. 로그인 리다이렉트는 Supabase 허용 목록에 없는 호스트라 실패하는 것이 정상 — 허용 목록에 추가하지 않는다(🔒 OAuth 설정 변경). 로그인 없는 페이지·API 401/403 만 확인 |
| 전환 조건 | 서울(App Service) ↔ 도쿄(Supabase) 왕복이 생기므로 주요 페이지 p95 를 현재 Cloudflare 와 비교 기록. 2단계에서 DB 가 서울로 오면 해소되므로, 30% 넘게 느려지면 1단계 전환을 2단계 직전까지 미루는 것을 검토 |
| 검증 | 공개 페이지 15개 200, 로그인 필요 10개 307, API 비로그인 401/403, 크론 무인증 401 (10-04 운영 스모크와 같은 목록), App Insights 에 요청 기록, 응답 시간 p50·p95 를 Cloudflare 와 비교 기록 |
| 🔒 | 리소스 생성 |
| 롤백 | App Service 삭제 |

### 1-4. 전환 (DNS)

선행: 홈페이지 세션의 DNS 작업 완료 통보 — ✅ 2026-10-04 23시 KST 완료 통보 받음. 사용자에게 Cloudflare 레코드 수정을 안내할 때는 **콘텐츠 열로 행을 구분**하게 한다 (`www` 의 콘텐츠가 `knockknock.company` 라 `@` 와 헷갈린 이력). 전환 당일 순서 (평일 KST 10~11시 — 문제 시 바로 대응 가능한 시간, 크론 없는 시간대):

1. 직전 확인: 진행 중 결제 0건 (`paid_tester_orders` 결제 대기). GitHub 크론은 3~6시간 늦게 돌아 일정표로는 판단할 수 없으므로, **GitHub 웹에서 `cron.yml` 워크플로우를 Disable** 하고 진행 중 실행이 없는지 Actions 화면에서 확인 (로컬 `gh` 토큰은 만료 이력 — 사용자 수행)
2. Cloudflare 에서 `tester-match` 레코드를 **프록시 끔(DNS 전용)** 으로 먼저 바꾼다 — 프록시 뒤에선 관리형 인증서 발급이 실패할 수 있음 [추정] (🔒 DNS 변경)
3. App Service 에 커스텀 도메인 바인딩 준비 — `asuid.tester-match` TXT 추가 (🔒 DNS 변경)
4. `tester-match` CNAME 을 Pages → App Service 로 변경, TTL 300 (🔒 DNS 변경)
5. 관리형 인증서 발급 확인 → HTTPS 접속
6. 실사용 스모크: Google 로그인(콜백이 같은 도메인이라 Supabase 설정 무변경), 체크인 1회(테스트 계정), 유료 시트 주문 화면, 관리자 페이지
7. `cron.yml` 워크플로우 Enable — 같은 도메인을 부르므로 이제 Azure 로 향한다. **Functions 타이머는 아직 비활성**

| 검증 | 24시간 App Insights 5xx < 0.5%, 크론 7종 모두 1회 이상 200 |
| 🔒 | DNS 변경, 운영 전환 |
| 롤백 | CNAME 을 Pages 로 되돌림 (TTL 300 → 최대 5분), 프록시 원복. Pages 배포는 손대지 않았으므로 즉시 복귀 |

### 1-5. 크론 이전과 정리

1. 전환 7일 무사고 → **순서 고정**: ① GitHub `cron.yml` Disable + 진행 중 실행 없음 확인 ② `schedule` 제거 커밋 (수동 실행 `workflow_dispatch` 는 남김) ③ 그 다음 Functions 타이머 활성 (🔒 크론 대상 변경). 거꾸로 하면 이중 실행 창이 생기고, 리마인더 메일은 멱등이 아니어서 중복 발송된다
2. 30일 무사고 → Cloudflare Pages 프로젝트 해지 (🔒 기존 서비스 해지). 해지 전 마지막 배포 산출물 보관
3. 문서: `DEPLOY.md`, `03-output/infra/`, `tm-deploy` 스킬 갱신

## 2단계 — DB·인증·스토리지 이전 (필수)

착수 조건: 1단계 전환 후 7일 무사고. 착수 전 **길 2′ PoC 1일** (Azure PostgreSQL 스테이징 + PostgREST 컨테이너로 supabase-js 쿼리 10개 실행) → 성공이면 쿼리 재작성 생략, 실패면 Drizzle 재작성.

### 2-1. 스키마·코드 (브랜치 `feat/azure-db`)

| 작업 | 내용 |
|---|---|
| 스키마 | 현 마이그레이션에서 Supabase 전용부 제거판 생성: RLS 정책·`anon`/`authenticated`/`service_role` GRANT 삭제, `auth.users` FK → `app_auth.users` 로, `handle_new_auth_user` 트리거 → 앱 코드(로그인 콜백)로 이동 — `ensure_member_row`·`create_email_member` RPC 가 이미 그 역할을 일부 함 |
| 데이터 접근 | 약 80개 파일 / 약 320곳 → Drizzle. 임베드 ~14곳 → 명시 조인. RPC 6곳 → `select fn(...)` |
| 인증 | Auth.js v5: Google provider + Credentials(bcrypt 검증), 세션 쿠키, 미들웨어 교체. 이메일 가입 2단계 흐름·`__Host-` 토큰 쿠키·사전등록 연결 규칙(ADR-0013 보강 7항목) **그대로 재현**하고 기존 검증 스크립트(`03-output/supabase/checks/verify_auth_linking.py`, 33 시나리오)를 새 스택용으로 이식 |
| 스토리지 | 4개 파일 → Blob SDK + 사용자 위임 SAS |
| 리뷰 | 보안 리뷰 2회 이상 + DB 리뷰 (ADR-0013 때와 같은 수준) |

### 2-2. 리허설 (T−7일)

1. 스테이징 PostgreSQL 생성 (🔒 리소스 생성, 🔒 운영 데이터 복사)
2. 운영 Supabase → `pg_dump --schema=public --no-owner --no-acl` → 복원
3. 인증 데이터: `auth.users` (id, email, encrypted_password(bcrypt), email_confirmed_at, `raw_user_meta_data`·`raw_app_meta_data`, `email_change*`, 생성·로그인 시각) + `auth.identities` **전 provider** (google·email — provider, provider_id, identity_data) → `app_auth` 로 변환 적재. **UUID 그대로**. 세션·리프레시 토큰은 옮기지 않는다 (전원 재로그인)
4. §2-4 대조 쿼리 전부 일치 확인, 스테이징 앱으로 Google·이메일 로그인 시험 (스테이징 도메인을 Google OAuth 리다이렉트 URI 에 임시 추가 🔒)
5. 소요 시간 측정 → 본 전환 점검 시간 확정

### 2-3. 전환 당일 (점검 시간 예상 60분, KST 03:00~04:00 — 30일 활성 약 260명 기준 최저 접속 시간대 [추정])

| 시각 | 작업 |
|---|---|
| T−1일 | 게시판·오픈채팅 공지 — 점검 시간 + **전환 후 모든 회원 재로그인 필요** (Supabase 세션·리프레시 토큰은 이전되지 않음). 결제 대기 주문 0 확인, 신규 주문 일시 중단(공개 플래그 false) |
| T−0:10 | GitHub/Functions 크론 전부 비활성 (🔒) |
| T0 | 점검 모드 (쓰기 API 503 + 안내 페이지) 배포 |
| T+0:05 | 최종 `pg_dump` + 인증 데이터 추출 → 복원 → **시퀀스 `setval` 재설정**(각 bigint PK 를 max(id) 이상으로) |
| T+0:20 | §2-4 대조 — **하나라도 불일치면 중단, 점검 해제, Supabase 로 계속 운영** |
| T+0:30 | 앱 설정 교체 (`DATABASE_URL`, Auth.js 비밀) → 2단계 빌드 배포 |
| T+0:40 | 스모크: Google 로그인(기존 계정 → 같은 회원 행), 이메일 로그인(테스트 계정), 체크인, 콘솔 스크린샷 업로드·열람, 관리자 주문 화면 |
| T+0:50 | 크론 재활성 (Functions), 점검 해제, 주문 재개 |
| T+2:00 | **롤백 결정 시점** — 이후엔 Azure 쪽 신규 쓰기가 쌓여 역동기화가 필요 |

외부 설정 변경 목록 (전부 🔒):
- Google Cloud OAuth 클라이언트: 승인된 리디렉션 URI 에 `https://tester-match.knockknock.company/api/auth/callback/google` 추가 (Supabase 콜백은 롤백 대비 30일 유지)
- Supabase: 전환 후 30일 읽기 전용 보존 → 일시정지 → 해지
- 토스: 성공·실패 URL 은 같은 도메인 상대 경로라 **변경 없음**, 웹훅 없음 [검증]
- Resend: 2단계에선 변경 없음 (3단계에서 ACS 로) · 사이트맵·검색 등록: 도메인 동일하여 변경 없음

### 2-4. 전환 전후 대조 (리허설·본 전환 공통)

| 대조 | 쿼리 요지 | 기준 |
|---|---|---|
| 테이블별 행 수 | 스키마 전체 27개 테이블 `count(*)` | 완전 일치 |
| 크레딧 원장 | 사용자별 `sum(amount)` + 전체 합 + 행 수, type·ref_type 별 건수 | 완전 일치 |
| 원장 멱등 | 부분 unique 7개 존재 확인, append-only 트리거 존재 확인 | 존재 |
| 주문·결제 | `paid_tester_orders` 상태별 건수·금액 합, `payments` 상태별 | 완전 일치 |
| 보상 | `seat_rewards` 상태별 건수·금액 합, `credit_redemptions` 상태별 | 완전 일치 |
| 14일 진행 | 진행 중 매칭마다 `opted_in_at` (timestamptz) 와 앱 함수 `currentDayN(now)` 결과, 매칭별 체크인 수·최대 `day_n` | 매칭 단위 완전 일치 (원본·대상에서 같은 시각 기준 계산) |
| 인증 | `auth.users` 수 = `app_auth.users` 수, provider 별 identity 수, 이메일 확인 여부 분포, `users.auth_user_id` 가 가리키는 UUID 전부 존재 | 완전 일치 |
| 시퀀스 | 각 bigint PK 시퀀스 현재값 ≥ max(id) | 충족 (다음 insert 충돌 방지) |
| 스토리지 | 객체 수·바이트 합 (현재 0) | 일치 |

### 2-5. 2단계 롤백

- T+2h 이전: 앱 설정을 Supabase 로 되돌리고 1단계 빌드 재배포 (Supabase 는 점검 시작 이후 쓰기가 없었으므로 그대로 유효).
- T+2h 이후: Azure 쪽 신규 행을 id 범위로 추출해 Supabase 에 재적재 + 원장 대조 → 3~5일 작업 [추정]. 그래서 롤백 판정은 T+2h 안에 내린다.

## 3단계 — 메일 발송·DNS 이전, 기존 서비스 해지

### 3-1. 메일 발송 Resend → ACS Email

| | 내용 |
|---|---|
| 작업 | ACS 리소스·이메일 서비스 생성(데이터 위치 Korea) → 사용자 지정 도메인 `knockknock.company` 추가 → 인증 레코드(도메인 확인 TXT·SPF include·DKIM 2개)를 **현재 DNS(Cloudflare)** 에 추가 → 발신 주소 `noreply@knockknock.company` → **발송 한도 증액 지원 요청** (기본 시간당 100통, 검토 최대 72시간) |
| 코드 | `lib/email.ts` 1개 파일 — Resend REST → `@azure/communication-email` (연결 문자열은 Key Vault). 메일 본문 이스케이프·수신 불가 주소 차단 로직은 그대로 |
| 검증 | 테스트 계정으로 인증 메일·리마인더 1통씩 실제 발송, Gmail 에서 SPF·DKIM pass 확인 |
| 주의 | Resend 의 SPF·DKIM 레코드는 30일 병행 후 삭제. SPF 레코드는 **한 개**여야 하므로 Google·Resend·ACS include 를 한 줄에 합친다 |
| 🔒 | 리소스 생성, DNS 변경 |
| 롤백 | 앱 설정에서 메일 공급자를 Resend 로 되돌림 (병행 기간 동안 코드에 두 경로 유지) |

### 3-2. DNS Cloudflare → Azure DNS

| | 내용 |
|---|---|
| 선행 | `knockknock.company` 영역은 **홈페이지 이전 세션과 공유** — 위치 공용 그룹 `rg-knockknock-shared` **합의 완료**(2026-10-04). 홈페이지 세션이 자기 전환(Cloudflare Pages → Static Web Apps) 완료를 알리기 전에는 영역을 건드리지 않는다 |
| 홈페이지 몫 | ① 루트 `@` 는 Azure DNS 에서 CNAME 불가 → `swa-knockknock-homepage`(rg-homepage-prod-eas)를 가리키는 **alias A 레코드** (그룹 넘어 참조 가능) ② `@` 의 SWA 도메인 검증 TXT 는 **삭제 금지** — 인증서 갱신(2027-04 전) 때 재검증될 수 있음 ③ `@` 의 google-site-verification TXT 유지 ④ Cloudflare 프록시 기능(관리형 robots.txt 등) 소멸 — 홈페이지는 영향 없음 확인됨 |
| www | 현재 `www` CNAME → `knockknock.company`, Cloudflare **프록시(주황)** — 홈페이지가 나중에 루트로 301 을 걸 예정. Azure DNS 는 리다이렉트를 못 하므로 3-2 전에 홈페이지 세션이 SWA(커스텀 도메인 `www` + 리다이렉트)로 옮겨야 한다 — 이전 전 그 세션과 확인 |
| SPF | 현재 `v=spf1 include:_spf.google.com ~all`. ACS 추가 시 같은 한 줄에 ACS include 를 더한다 (SPF 레코드는 1개만). MX·DKIM(Google) 은 이전 직전에 직접 조회 |
| 작업 | Azure DNS 공개 영역 생성 → Cloudflare 의 **모든 레코드 내보내기·복사** (특히 Google Workspace MX·SPF·DKIM — 도메인 Gmail 수신이 여기에 달림, ACS·Resend 인증, 홈페이지, `asuid.*`) → 레코드별 대조 (`dig @<azure-ns>` vs `dig @<cloudflare-ns>`) → GoDaddy 에서 네임서버를 Azure 4개로 변경 (사용자) |
| 검증 | 48시간 동안 양쪽 응답 일치, 도메인 Gmail 송수신 시험, 사이트·인증 메일 정상 |
| 🔒 | DNS 변경 (네임서버 변경은 사용자 직접) |
| 롤백 | GoDaddy 네임서버를 Cloudflare 로 되돌림 (Cloudflare 영역은 30일 보존) |

### 3-3. 해지 (각각 🔒)

| 대상 | 시점 | 전 확인 |
|---|---|---|
| Cloudflare Pages `tester-match` | 1단계 전환 +30일 | 마지막 산출물 보관 |
| Supabase 프로젝트 | 2단계 전환 +30일 (읽기 전용 보존 후) | 최종 덤프를 Blob 에 보관 |
| Resend | 3-1 +30일 | 발송 로그 0 |
| Cloudflare 영역 | 3-2 +30일 | 질의 0, 홈페이지 세션 동의 |
| GitHub `cron.yml` | 1-5 직후 | Functions 7종 정상 |

## 일정 요약

| 주 | 내용 |
|---|---|
| W0~W2 | 0단계 (토스 라이브 안정화와 겹침) |
| W3 | 1-1~1-3 |
| W4 | 1-4 전환, 1-5 크론 병행 |
| W5~W9 | 2-1 개발·리뷰 (1단계 운영과 병행) |
| W10 | 2-2 리허설, 2-3 전환 |
| W11 | 3-1 메일 (한도 증액 대기 포함), 3-2 DNS |
| 전환 +30일 | 3-3 해지 |

## 진행 기록

| 일시 | 단계 | 내용 | 결과 |
|---|---|---|---|
| 2026-10-04 | 0 | `tm-az` 컨텍스트 확인 (스폰서십 구독, Enabled), App Service B1 Linux·PostgreSQL B1ms 의 Korea Central 제공 확인 | 통과 |
| 2026-10-04 | 1-1 (승인) | `rg-testermatch-prod-krc` 생성(태그 5개) · 예산 `budget-testermatch-monthly` $20 (알림 `admin@`, 템플릿 `03-output/infra/azure/budget.json`) · Policy `tm-allowed-locations`(koreacentral)·`tm-require-project-tag` | Succeeded, 그룹 내 리소스 0, 홈페이지 그룹 무변경 |
| 2026-10-04 | 1-1b | 리소스 공급자 6개 등록 (사용자, 포털) — 약 60초 후 전부 Registered. Functions Flex Consumption 의 Korea Central 지원 확인 | 통과 |
| 2026-10-04 | 1-1c (승인) | ARM `03-output/infra/azure/monitoring-keyvault.json` — what-if Create 3건 확인 후 배포: `log-testermatch-prod-krc`(보존 30일·일일 상한 0.5 GB) · `appi-testermatch-prod-krc`(작업영역 기반) · `kv-testermatch-prod-krc`(RBAC·soft delete 7일, 비밀 없음) | Succeeded |
| 2026-10-04 | 1-2 | worktree `.claude/worktrees/azure-hosting` (브랜치 `feat/azure-hosting`, 기준 origin/main `441c596`, 미커밋): edge 선언 92개 삭제 · `after()` 전환 2곳 · `lib/client-ip.ts`(오른쪽 끝 X-Forwarded-For, `TRUSTED_PROXY=cloudflare` 선택) · **크론 인증 기본 거부** · standalone 빌드(`build:azure`) · Cloudflare 의존성 제거 · `deploy-azure.yml`(수동·OIDC) · `03-output/infra/azure/cron-functions`(타이머 7개, `CRON_TIMERS_ENABLED=1` 일 때만) | tsc 0 · vitest 276 · eslint 0 · 빌드 OK · Functions 테스트 8 |
| 2026-10-04 | 1-2 리뷰 | 독립 리뷰 CRITICAL 0·HIGH 1·MEDIUM 4 → 반영: IP 헤더를 `CLIENT_IP_HEADER` 로 선택(기본 x-forwarded-for 마지막 항목, cf-connecting-ip·x-azure-clientip 가능), 배포 시 `server.js`·static 존재 검사, Functions `functionTimeout` 1시간. 남은 것 → 1-3 체크리스트 | 재검증 통과 |
| 2026-10-04 | 예산·DNS | 예산 $20 → **$100** 재배포 (Succeeded) · DNS 영역 위치 = 공용 그룹 `rg-knockknock-shared` 결정, 홈페이지 세션에 합의 요청 | — |
| 다음 | 1-3 체크리스트 | ① 시작 명령 `node server.js`, 앱 설정 `HOSTNAME=0.0.0.0`, PORT 확인 ② **스테이징에서 X-Forwarded-For 실측** 후 `CLIENT_IP_HEADER` 확정 (Cloudflare 프록시를 켜면 `cf-connecting-ip` 로 바꾸지 않으면 모든 가입이 한 IP 버킷 공유) ③ Key Vault 비밀 넣기 전 본인 계정에 `Key Vault Secrets Officer` (포털) ④ GitHub Secrets 3개 + Variables 6개 ⑤ 개인정보처리방침의 호스팅 업체(Cloudflare) 표기 변경 — 정책 문구라 **사용자 승인 필요** ⑥ **병합 직전** `feat/azure-hosting` 를 최신 main 에 맞추고 edge 제거 스크립트 재실행 — 문의 기능(다른 세션, 2026-10-04) 라우트 7개가 edge 선언을 달고 들어옴. `SLACK_INQUIRY_WEBHOOK_URL` 을 Key Vault 에 ⑦ 전환 후 정리: `middleware.ts` pages.dev 리다이렉트, `DEPLOY.md`·`NEXT.md` 의 wrangler 절차, 코드 주석의 Cloudflare 표현 | — |
| 2026-10-04 | 사고 | 로컬 standalone 스모크 중 크론 무인증 확인 요청이 운영 페널티 스윕을 1회 실행 — 무료 매칭 5건 이탈 처리. 사용자 결정 **유지**. 기록 `04-review/history/2026-10-04-local-cron-penalty-incident.md` (브랜치) | 재발 방지: 크론 인증 fail closed |
