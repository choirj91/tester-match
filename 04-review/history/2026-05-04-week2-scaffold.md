# 2026-05-04 — Week 2 코드 스켈레톤

> 12주 로드맵 Week 2 "기반(도메인·CI·랜딩)" 구간의 코드 부분 착수.
> Discovery(Week 1: 브랜드·도메인·경쟁사 인터뷰)는 사용자 결정으로 코드와 병행 진행.

---

## 세션 요약

기획 잠금 결정 3종을 그대로 따라 `03-output/`에 Next.js 15 + Supabase + Cloudflare Pages 스켈레톤을 일괄 생성. 핵심 도메인 12개 테이블의 초기 마이그레이션 작성. 사용자향 랜딩(한국어 Waitlist) 1페이지 + GitHub Actions CI 까지 코드 0줄 → 빌드 가능 골조로.

---

## 신규 산출물

### 03-output/app/ — Next.js 15 스켈레톤

| 파일 | 역할 |
|---|---|
| package.json | pnpm 9.12.3 / Next 15.1.3 / React 19 / Tailwind 4 베타 / Supabase SSR / zod / vitest |
| tsconfig.json | strict, paths `@/*`, `@cloudflare/workers-types` |
| next.config.ts | typedRoutes, Supabase 이미지 도메인 |
| postcss.config.mjs | `@tailwindcss/postcss` |
| eslint.config.mjs | `next/core-web-vitals` + `next/typescript` (Flat config) |
| .env.example | Supabase, Resend, Brevo, 토스, NextAuth, Sentry, PostHog |
| src/app/layout.tsx | Pretendard CDN, ko_KR 메타 |
| src/app/page.tsx | Trust Blue 600 + Spark Coral 액센트, 3단계 설명 |
| src/app/globals.css | Tailwind 4 `@theme` + 디자인 토큰 |
| src/components/waitlist-form.tsx | 이메일 1필드 + 상태 메시지 |
| src/app/api/waitlist/route.ts | POST 핸들러 (현재 stub, edge runtime) |
| src/lib/supabase/{server,client}.ts | `@supabase/ssr` 래퍼 |
| src/lib/env.ts | zod 기반 환경 변수 검증 |

### 03-output/supabase/ — DB

| 파일 | 역할 |
|---|---|
| config.toml | 로컬 Supabase CLI 설정 (port 54321~54324) |
| migrations/20260504000001_initial_schema.sql | ERD 12개 테이블 + waitlist_signups + RLS ENABLE |
| seed.sql | 운영자 1 + 더미 사용자 5 |
| README.md | 로컬 개발/마이그레이션 절차 |

### 03-output/infra/

| 파일 | 역할 |
|---|---|
| cloudflare-pages.md | 빌드 설정·환경 변수·도메인·일시정지 방지 가이드 |
| README.md | 추후 운영 문서 색인 |

### .github/workflows/ci.yml

`03-output/app/`에서 lint → typecheck → test → build. 마이그레이션 파일 빈 파일 검사. pnpm 9.12.3 + Node 20.

---

## 마이그레이션 설계 메모

- ERD `bigint identity` 그대로 따름. Supabase Auth `auth.users(uuid)` 연결은 후속 결정 (NextAuth vs Supabase Auth).
- `credits_ledger`는 트리거로 UPDATE/DELETE 차단 → append-only 보장.
- `matches`는 부분 unique index로 동일 (app_id, tester_user_id) 활성 매칭 1개 제한.
- RLS는 모두 ENABLE 했으나 정책은 비어 있음 → service_role 키로만 접근. 클라이언트 anon 키는 모든 테이블 차단됨. 정책 작성은 Auth 와이어링 시 후속.

---

## 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 패키지 매니저 | pnpm 9.12.3 | 사용자 지정. Next.js 15 + monorepo 친화. |
| Next.js 버전 | 15.1.3 (App Router) | React 19 안정 + Turbopack dev. |
| Tailwind | 4 베타 | CSS-first config, `@theme` 토큰. CF Pages 호환성은 Week 2 검증 항목. |
| Cloudflare 어댑터 | `@cloudflare/next-on-pages` | OpenNext-cloudflare 보다 성숙. |
| 마이그레이션 도구 | Supabase CLI raw SQL | Drizzle/Prisma 도입은 보류 (의존성 최소). |
| `waitlist_signups` 테이블 | ERD 외 추가 | Week 1 랜딩 즉시 사용. v1 출시 후 archive. |

---

## 미완료 / 다음 작업

### 즉시 (사용자 액션 필요)

- [ ] `cd 03-output/app && pnpm install` — lockfile 생성
- [ ] `pnpm dev` — 로컬에서 랜딩 렌더 확인 (localhost:3000)
- [ ] GitHub Private 레포 생성 후 푸시 (.github/workflows/ci.yml 동작 확인)
- [ ] Supabase 프로젝트 생성 → URL/키 → `.env.local` 채우기
- [ ] `supabase link --project-ref <ref>` → `supabase db push`

### 코드 후속 (Week 3 진입 전)

- [ ] Tailwind 4 베타 → Cloudflare Pages 빌드 호환 검증 (`pnpm pages:build`)
- [ ] `/api/waitlist` Supabase 연동 (현재 console.log)
- [ ] `vitest` 첫 단위 테스트 (env 검증, waitlist 입력 검증)
- [ ] middleware.ts 생성 (Supabase 세션 갱신용)

### 결정 대기

- [ ] **Auth 전략**: NextAuth(Auth.js v5) vs Supabase Auth — RLS 정책 작성 방식이 갈린다.
- [ ] **카테고리 마스터**: 별도 테이블 vs enum vs JSON. F-APP-05 진입 시 결정.
- [ ] **운영 Supabase 분리**: Local/Preview/Production 어떻게 할지.

---

## 참고

- 잠금 결정: [ADR-0001](../../01-source/decisions/ADR-0001-target-market.md), [ADR-0002](../../01-source/decisions/ADR-0002-hosting.md), [ADR-0003](../../01-source/decisions/ADR-0003-credit-model.md)
- 디자인 토큰: [09_design_concept.md §1](../../01-source/spec/09_design_concept.md)
- ERD 원천: [06_erd.md](../../01-source/spec/06_erd.md)
- 기능 우선순위: [03_feature_specification.md](../../01-source/spec/03_feature_specification.md)
