# 2026-05-04 — Supabase Auth 연결

> Week 3 첫 작업: 인증 와이어링. 사용자 결정으로 Supabase Auth 채택([ADR-0004](../../01-source/decisions/ADR-0004-auth-strategy.md)).

---

## 세션 요약

- ERD §2.12 "NextAuth 관리"를 ADR-0004 로 무효화. 기존 ERD 텍스트는 01-source 읽기 전용 원칙으로 손대지 않고 본 노트에 변경 사유 기록.
- `public.users.id` (bigint) 유지. `auth_user_id uuid` 컬럼 추가로 `auth.users(id)` 와 연결.
- `auth.users` insert 트리거가 `public.users` 자동 생성 (이메일 충돌 시 기존 auth_user_id 보존하여 계정 탈취 차단).
- `/auth/login` (Google 버튼만) + `/auth/callback` (PKCE 코드 교환) + `/auth/signout` (303 리다이렉트) 구현.
- env 정리: `AUTH_SECRET`, `AUTH_GOOGLE_*` 제거. Google 자격증명은 Supabase Dashboard 관리.

---

## 신규 산출물

| 경로 | 내용 |
|---|---|
| 01-source/decisions/ADR-0004-auth-strategy.md | Supabase Auth 채택 + 거부 이유 + 재검토 트리거 |
| 03-output/supabase/migrations/20260504000002_auth_link.sql | `auth_user_id` 추가 + `handle_new_auth_user()` 트리거 |
| 03-output/app/src/app/auth/login/page.tsx | 로그인 카드 (한국어, 약관/개인정보 링크) |
| 03-output/app/src/app/auth/login/google-sign-in-button.tsx | Client component, `signInWithOAuth({ provider: 'google' })` |
| 03-output/app/src/app/auth/callback/route.ts | `exchangeCodeForSession`, edge runtime |
| 03-output/app/src/app/auth/signout/route.ts | POST → signOut → / 리다이렉트 |
| 03-output/app/src/lib/auth.ts | `getCurrentUser()` 서버 헬퍼 (auth.users + public.users 조인) |
| 03-output/infra/supabase-auth-setup.md | Google Cloud Console + Dashboard 설정 + 검증 + 운영 전환 체크리스트 |

## 수정

| 파일 | 변경 |
|---|---|
| 03-output/app/.env.example | NextAuth 섹션 제거, Supabase Auth 안내로 대체 |
| 03-output/app/.env.local | NextAuth 주석 라인 제거 |
| 03-output/app/src/lib/env.ts | `AUTH_SECRET` 검증 제거 |
| 03-output/infra/README.md | supabase-auth-setup.md 인덱스 추가 |

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| user.id 형식 | bigint 유지 + `auth_user_id uuid` 별도 | ERD/도메인 PK 유지, 다른 테이블 FK 영향 없음 |
| 약관 동의 시점 | 트리거가 OAuth 완료 시 즉시 `now()` | 명시적 동의 UX (F-AUTH-04)는 Week 3 후반 정교화 예정 |
| OAuth scopes | `access_type: offline`, `prompt: select_account` | 토큰 갱신 + 다중 계정 사용자 명시 선택 |
| RLS 정책 | 본 마이그레이션엔 미포함 | 도메인 모델 통합 후 다음 마이그레이션에서 일괄 작성 |

---

## 사용자 액션 필요

1. Google Cloud Console: OAuth Client 생성, redirect URI에 `https://eebilophixfdzclmcpoo.supabase.co/auth/v1/callback` 등록
2. Supabase Dashboard → Authentication → Providers → Google → Client ID/Secret 입력 + Enable
3. Authentication → URL Configuration → Site URL = `http://localhost:3000`, Redirect URLs에 `http://localhost:3000/auth/callback` 추가
4. `cd 03-output && supabase db push` (마이그레이션 2 적용)
5. `pnpm dev` → `/auth/login` → Google 로그인 → `/`로 복귀 + `public.users` row 확인

상세: [03-output/infra/supabase-auth-setup.md](../../03-output/infra/supabase-auth-setup.md)

---

## 미완료 / 후속

- [ ] 헤더에 로그인 상태 / 로그아웃 폼 표시 (현재 `/auth/login`은 직접 URL로만 접근)
- [ ] RLS 정책 마이그레이션 (per-table, `auth_user_id` 기반)
- [ ] F-AUTH-04 명시적 동의 UX — `terms_agreed_at` 갱신 흐름 분리
- [ ] 회원 탈퇴 — `auth.users` cascade vs `public.users.deleted_at` soft delete 결정
- [ ] OAuth consent screen Production publish (배포 직전)
