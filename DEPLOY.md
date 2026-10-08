# DEPLOY — 배포 절차

> 2026-10-05 부터 운영은 **Azure App Service** (`app-testermatch-prod-krc`, Korea Central). Cloudflare Pages 로 배포해도 방문자에게 보이지 않는다 (DNS 가 Azure 를 가리킴).
> 결정: [ADR-0015](01-source/decisions/ADR-0015-azure-migration.md) · 계획·진행: [03-output/azure-migration/](03-output/azure-migration/00-VERDICT.md)

## 표준 배포 (GitHub Actions)

1. `main` 에 병합 (CI: lint·typecheck·test·build 통과)
2. GitHub → Actions → **Deploy (Azure App Service)** → Run workflow → 브랜치 `main` → 입력란에 `deploy`
   - CLI: `gh workflow run deploy-azure.yml -R choirj91/tester-match --ref main -f confirm=deploy`
3. 실행 화면의 **Review deployments** → `azure-prod` → Approve and deploy (사용자 승인 — 배포 게이트)
4. 끝나면 확인: 주요 페이지 200, 로그인 필요 페이지 307, `/api/notifications` 비로그인 401

워크플로우가 하는 일: pnpm 설치(**hoisted** — 심볼릭 링크 구조는 standalone zip 에서 모듈이 빠짐) → typecheck → test → `pnpm build:azure`(standalone) → `.env`·링크 미포함·`server.js` 존재 검사 → OIDC 로 Azure 로그인 → App Service zip 배포.

로컬에서 Azure 리소스를 다룰 때는 **반드시** `05-harness/scripts/tm-az` (회사 Azure 계정과 분리된 설정·리소스 그룹 고정). 맨 `az` 금지 — [06-isolation-runbook.md](03-output/azure-migration/06-isolation-runbook.md).

## DB 마이그레이션 (코드 배포 전에)

DB 는 아직 Supabase (2단계에서 Azure PostgreSQL 로 이전 예정).

```bash
cd <repo>/03-output
npx supabase db push
```

- **순서 중요**: 스키마가 바뀌는 코드는 마이그레이션 먼저 → 코드 배포
- **Azure PostgreSQL (PostgREST 사이드카)**: 열·함수를 더하거나 바꾼 마이그레이션을 psql 로 적용했으면 같은 DB 에 `notify pgrst, 'reload schema';` 를 실행한 뒤 코드를 배포한다. 안 하면 PostgREST 가 옛 스키마 캐시로 새 열·RPC 를 PGRST204/PGRST202 로 거절한다 (예: ADR-0020 `20261008000001`·`20261008000002`)
- 여러 세션이 같은 트리를 쓴다 — 마이그레이션 번호대를 세션별로 띄울 것

## 환경 변수

| 구분 | 위치 | 바꾸면 |
|---|---|---|
| 빌드 타임 공개값 `NEXT_PUBLIC_*` (Supabase URL·publishable key·PortOne store/channel·앱 URL·앱 이름·가입 플래그) | GitHub → Settings → Environments → `azure-prod` → **Variables** | 재배포 필요 |
| 런타임 비밀 (`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `PORTONE_API_SECRET`, `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SLACK_INQUIRY_WEBHOOK_URL`) | Key Vault `kv-testermatch-prod-krc` → App Service 앱 설정이 `@Microsoft.KeyVault(...)` 로 참조 | 앱 재시작 (`tm-az webapp restart`) |
| 런타임 일반값 (`GOOGLE_ADMIN_EMAIL`, `TESTER_GROUP_EMAIL`·`_URL`, `PAID_TESTERS_ORDER_ALLOWLIST`, `RESEND_FROM_EMAIL`, `CLIENT_IP_HEADER`, `HOSTNAME=0.0.0.0` …) | App Service 앱 설정 | 자동 재시작 |
| 배포 자격 (`AZURE_CLIENT_ID`·`_TENANT_ID`·`_SUBSCRIPTION_ID`) | `azure-prod` → **Secrets** (Variables 아님 — 공개 리포 로그 노출 방지) | — |
| 크론 비밀 `CRON_SECRET` | 저장소 Secrets (cron.yml) + Key Vault — **두 곳 같은 값** | 둘 다 바꿀 것 |

새 환경변수를 추가하면 위 표의 위치에 넣고, 비밀이면 Key Vault → 앱 설정 참조로 연결한다.

## 크론

`.github/workflows/cron.yml` (GitHub Actions) 이 `https://tester-match.knockknock.company/api/cron/*` 를 Bearer `CRON_SECRET` 으로 호출. Azure Functions 타이머(`03-output/infra/azure/cron-functions`)로 옮길 예정 — 옮길 때는 cron.yml 을 **먼저 끄고** 타이머를 켠다 (리마인더 메일 중복 방지).

**로컬 서버(`next dev`·standalone)의 `/api/cron/*` 에는 어떤 요청도 보내지 않는다** — 로컬 `.env.local` 은 운영 DB 를 가리킨다 (2026-10-04 페널티 스윕 사고).

## 커밋 규칙

- 커밋 메시지 **영어**
- `--force`, `--no-verify` 금지 (CLAUDE.md 절대 금지)
- 되돌릴 땐 `git revert`
- 리포는 **공개** — 테넌트·구독 ID, 비밀값, 운영 추출 데이터를 커밋하지 않는다

## ⚠️ 사고 이력 (반복 금지)

| 사고 | 원인 | 예방 |
|---|---|---|
| 이전 빌드가 배포됨 (Cloudflare 시절) | 잘못된 cwd 에서 빌드 실패 → 파이프 exit 0 | 단계 분리, `&&` 체인에 `\| head` 금지 |
| 게시판 전체 소실 (PGRST201) | 조인 테이블 추가로 임베드 모호 | FK 힌트(`!posts_author_user_id_fkey`) |
| 로컬 스모크가 운영 페널티 스윕 실행 (10-04) | 로컬 env 에 `CRON_SECRET` 없음 + 크론 인증이 fail open | 크론 인증 기본 거부로 변경, 로컬 크론 호출 금지 |
| App Service 기동 실패 `styled-jsx` 없음 (10-05) | pnpm 심볼릭 링크가 zip 에서 풀림 | CI 설치 hoisted + 링크 검사 |
| 인증서 오류 수 분 (10-05 전환) | RG 의 `project` 태그 필수 정책이 CLI 인증서 생성을 거부 | 관리형 인증서는 `03-output/infra/azure/managed-certificate.json` (태그 포함) 으로 |
| 로그인 후 `https://0.0.0.0:8080/` 로 이동 (10-05) | standalone 의 `request.url` 이 바인딩 주소 | 리다이렉트·출처 비교는 `lib/public-origin.ts` 의 `publicOrigin()` 사용 |

## 롤백

- 코드: 이전 커밋을 같은 워크플로우로 다시 배포
- 인프라 전체: Cloudflare DNS 에서 `tester-match` CNAME 을 `tester-match.pages.dev` 로 (Pages 프로젝트는 보존 중). 이때 Cloudflare 시크릿 `CRON_SECRET` 도 현재 값으로 맞춰야 크론이 동작한다

## 브랜치 전략

- `main` = 프로덕션 기준. 기능 브랜치 → PR → main → Azure 배포 워크플로우
- `feat/adsense-placements` = 광고 배치 보존
