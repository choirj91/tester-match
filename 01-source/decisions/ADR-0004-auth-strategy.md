# ADR-0004: 인증 전략 — Supabase Auth 채택

- **상태**: Accepted (2026-05-04 잠금)
- **결정자**: nakjun
- **관련**: 01-source/spec/06_erd.md §2.1, §2.12, 03-output/supabase/migrations/

---

## Context

ERD §2.12는 "sessions: NextAuth가 관리"로 명시했으나, 실제 코드 착수 시점에 Auth 전략을 재검토. RLS(Row Level Security) 정책 작성 비용이 12주 일정에 미치는 영향이 가장 큰 변수.

### 후보

| 안 | RLS 통합 | ERD 호환 | 보일러플레이트 | 외부 의존성 |
|---|---|---|---|---|
| A. **Supabase Auth** | `auth.uid()`로 정책 직접 작성 가능 | `users.id bigint` 유지 + `auth_user_id uuid` FK 추가 (마이그레이션 1건) | 최소 | Supabase 단일 |
| B. Auth.js (NextAuth v5) | `auth.uid()` 미사용 → RLS 정책마다 서버측 검사 작성 | ERD 그대로 | 큼 (provider 설정, JWT 콜백, adapter) | next-auth + adapter |
| C. Clerk | 매니지드, MAU 10K까지 무료 | `clerk_user_id` 추가 필요 | 작음 | Clerk 락인 |

---

## Decision

**A. Supabase Auth** 채택.

### 핵심 근거

1. **RLS 작성 비용 절감**: `where auth_user_id = (select id from public.users where auth_user_id = auth.uid())` 같은 단순 패턴으로 12개 테이블 정책을 빠르게 작성 가능. 솔로 개발자 일정에서 가장 큰 이득.
2. **ERD 호환**: `users.id bigint` 그대로 유지하고 `auth_user_id uuid unique references auth.users(id)` 컬럼만 추가. 도메인 PK는 bigint로 유지(타 테이블 FK 영향 없음).
3. **단일 의존성**: Supabase 한 곳에서 Auth + DB + Storage 일괄 관리. 무료 티어 50K MAU 충분.

### 거부 이유

- **B (NextAuth)**: provider 추가 자유도는 매력적이나 RLS 통합 손실이 크다. Google OAuth 단일 provider로 시작하는 v1에서는 과한 유연성.
- **C (Clerk)**: 무료 티어는 충분하지만 v3 외부 포인트 전환·다국가 결제 단계에서 락인 비용 우려.

---

## Consequences

### 코드/스키마

- `public.users`에 `auth_user_id uuid unique references auth.users(id) on delete cascade` 추가
- `auth.users` insert 트리거로 `public.users` 자동 생성 (email, google_id, nickname 메타데이터 매핑)
- `terms_agreed_at` / `privacy_agreed_at`은 트리거에서 `now()`로 채움 → F-AUTH-04(명시적 동의 UX)에서 추후 정교화
- ERD §2.12 "NextAuth" 표기는 본 ADR로 무효. ERD 직접 수정 X (01-source 읽기 전용 원칙) — `04-review/history/`에 변경 사유 기록.

### 운영

- Google OAuth 자격증명은 **Supabase Dashboard에서 관리** (앱 `.env`에 저장 X)
- 콜백 URL: `https://<project>.supabase.co/auth/v1/callback` (Google Cloud) + `<app>/auth/callback` (Supabase Allowed Redirect URLs)
- `AUTH_SECRET`, `AUTH_GOOGLE_*` 환경 변수 제거

### 정책

- 이용약관 §X "본인확인" 조항은 OAuth 기반으로 작성 (이메일 매직 링크는 v1.5 추가 예정)
- 회원 탈퇴(F-AUTH-04) 시 `auth.users` cascade 삭제 → `public.users` 함께 삭제 vs `deleted_at` soft delete: **soft delete 우선** (감사 로그 보존). 트리거가 아닌 앱 레벨에서 처리.

### 향후 재검토 트리거

- Auth.js로 회귀가 필요해지는 시나리오: 카카오·네이버 OAuth provider 추가가 Supabase Native에서 비효율적일 때, JWT 클레임 커스터마이즈가 정책상 필수일 때.
- 2026 Q3 (M6) 시점에 RLS 정책 작성 시간 누적값 회고 후 적정성 평가.
