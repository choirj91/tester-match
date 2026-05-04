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

## 새 마이그레이션 추가

```bash
supabase migration new <name>     # 빈 SQL 파일 생성
# migrations/<timestamp>_<name>.sql 에 SQL 작성
supabase db reset                 # 로컬 검증
```

## 원격 프로젝트 링크 (운영)

```bash
supabase link --project-ref <ref>
supabase db push                  # 로컬 마이그레이션을 원격에 적용
```

## 마이그레이션 이력

| 파일 | 내용 |
|---|---|
| 20260504000001_initial_schema.sql | ERD v0.1 12개 테이블 + waitlist_signups + RLS ENABLE (정책은 후속) |

## 다음 작업

- [ ] RLS 정책 마이그레이션 (NextAuth 연동 시점에 작성)
- [ ] `auth.users` ↔ `public.users` 연결 결정 (Supabase Auth vs NextAuth)
- [ ] 카테고리 마스터 테이블 추가 (F-APP-05)
