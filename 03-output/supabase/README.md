# Supabase

DB 스키마·시드·로컬 개발 설정.

## 로컬 DB 띄우기

```bash
# Supabase CLI 설치
brew install supabase/tap/supabase

cd 03-output/supabase
supabase start                    # docker로 Postgres + Studio 기동
supabase db reset                 # 마이그레이션 + seed 일괄 적용
```

| 항목 | 기본 값 |
|---|---|
| API URL | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Inbucket (메일) | http://127.0.0.1:54324 |

## 개발 서버가 붙을 DB 고르기 — `tm-dev` (Docker 없음)

`pnpm dev` 가 어느 DB 를 쓸지 `05-harness/scripts/tm-dev` 로 바꾼다. PostgREST·GoTrue 는 운영 사이드카와 같은 버전의 바이너리를 이 PC 에서 직접 띄우고(127.0.0.1:3001·9999), 브라우저·서버 모두 개발 서버를 거쳐 접근한다 — 운영과 같은 경로. 결과는 `03-output/app/.env.development.local` 에 쓰이고(`.env.local` 보다 우선), `.env.local` 은 건드리지 않는다. 바꾼 뒤 `pnpm dev` 재시작.

| 명령 | 내용 |
|---|---|
| `tm-dev setup` | PostgREST v16.4·supabase/auth v2.197.0 바이너리를 `~/.local/share/tester-match/bin` 에 설치 (최초 1회) |
| `tm-dev local-init` | 로컬 PostgreSQL 17(Homebrew)에 `testermatch` DB 를 **지우고 다시** 만든다 — 역할 · GoTrue 스키마 · 운영 public 스키마(구조만, 읽기 전용으로 덤프) · `seed.sql` |
| `tm-dev local-init --with-prod-data` | 위 + 운영 데이터(public 전체, auth.users·identities). 개인정보가 이 PC 에 저장되므로 필요할 때만 |
| `tm-dev local` | 로컬 DB 로 개발. 가입 허용·이메일 자동 확인 |
| `tm-dev prod` | **운영 Azure PostgreSQL**. 읽기·쓰기 모두 운영에 반영. 가입 끔 |
| `tm-dev off` | 서비스 중지, 덮어쓰기 파일 삭제 → `.env.local` |
| `tm-dev status` | 현재 모드·프로세스 |

- 비밀값(저장소 밖, 권한 600, 값은 작은따옴표): `~/.config/tester-match/prod-db.env` — `JWT_SECRET`·`ANON_JWT`·`SERVICE_JWT`·`PGRST_DB_URI`·`GOTRUE_DATABASE_URL`·`AZURE_STORAGE_CONNECTION_STRING`·`PG_ADMIN_URI`(원본 Key Vault `kv-testermatch-prod-krc`) / `~/.config/tester-match/local-db.env` — `local-init` 이 생성
- 두 모드 공통 안전장치: 메일 발송 끔 · 크론 라우트 닫힘 · Google 로그인 끔(localhost 리디렉션 URI 미등록 — 이메일 로그인만)
- 로그: `~/.local/state/tester-match/{postgrest,gotrue}.log`
- 운영 모드는 이 PC 의 공인 IP 가 Azure PostgreSQL 방화벽에 있어야 한다
- 포트 3000 이 아니면 `TM_DEV_ORIGIN=http://localhost:<port> tm-dev local`
- 아래 Docker 기반 `supabase start` 는 마이그레이션 SQL 검증용으로만 남겨 둔다

## 새 마이그레이션 추가

```bash
supabase migration new <name>     # 빈 SQL 파일 생성
# migrations/<timestamp>_<name>.sql 에 SQL 작성
supabase db reset                 # 로컬 검증
```

## 원격 프로젝트 링크 (운영)

2026-10-05 부터 운영 DB 는 Azure PostgreSQL 이다 (ADR-0015). Supabase 클라우드 프로젝트는 30일 롤백용 사본이라 `supabase db push` 로 운영에 반영되지 않는다. 새 마이그레이션은 Azure 서버 관리자(`tmadmin`, 비밀번호 Key Vault `pg-admin-password`)로 `psql "host=<server>.postgres.database.azure.com dbname=<db> user=<admin> sslmode=require" -f <file>` 로 적용한다.

```bash
# (롤백 기간에만) Supabase 사본
supabase link --project-ref <ref>
```

## 마이그레이션 이력

| 파일 | 내용 |
|---|---|
| 20260504000001_initial_schema.sql | ERD v0.1 12개 테이블 + waitlist_signups + RLS ENABLE (정책은 후속) |

## 다음 작업

- [ ] RLS 정책 마이그레이션 (NextAuth 연동 시점에 작성)
- [ ] `auth.users` ↔ `public.users` 연결 결정 (Supabase Auth vs NextAuth)
- [ ] 카테고리 마스터 테이블 추가 (F-APP-05)
