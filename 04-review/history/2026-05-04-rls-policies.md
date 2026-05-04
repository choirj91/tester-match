# 2026-05-04 — RLS 정책 마이그레이션

> 모든 도메인 테이블에 클라이언트 접근 정책 작성. 도메인 기능 진입 전 보안 베이스라인 확보.

---

## 세션 요약

ADR-0004 의 RLS-by-default 전략을 실제 정책으로 구체화. 13개 테이블의 SELECT/INSERT/UPDATE/DELETE를 `auth_user_id` 매핑 기반으로 통제. service_role 키(서버 admin client)는 RLS 우회 — 매칭 엔진·결제 webhook 등은 서버에서 그대로 INSERT/UPDATE 가능.

---

## 신규 산출물

| 파일 | 내용 |
|---|---|
| 03-output/supabase/migrations/20260504000003_rls_policies.sql | 헬퍼 2개 + 권한 보호 트리거 1개 + 정책 약 15개 |

### 헬퍼 함수

| 함수 | 반환 | 용도 |
|---|---|---|
| `public.current_app_user_id()` | `bigint` | `auth.uid()` 로 매핑된 `public.users.id`. security definer로 RLS 우회. |
| `public.is_admin()` | `boolean` | 현재 사용자 role='admin' 여부. NULL 안전(coalesce false). |

### 보호 트리거

`users_protect_admin_fields_trg` (BEFORE UPDATE) — 비-admin 이 본인 row UPDATE 시 `role` / `trust_score` / `status` 변경 시도를 silently 원복. 권한 상승(role='admin') 공격 차단.

### 정책 매트릭스

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| users | 본인 / admin | 트리거 only | 본인 (보호 필드 제외) | ✕ |
| devices | 본인 / admin | 본인 | 본인 | 본인 |
| apps | matching / 본인 / admin | 본인 owner | 본인 owner | 본인 owner |
| matches | 참여자 / admin | 서버 only | 서버 only | 서버 only |
| checkins | 참여자 / admin | 본인 active 매치 | 서버 only | 서버 only |
| credits_ledger | 본인 / admin | 서버 only | trigger blocks (append-only) | trigger blocks |
| payments | 본인 / admin | 서버 only | 서버 only | 서버 only |
| boost_orders | 앱 owner / admin | 서버 only | 서버 only | 서버 only |
| reports | reporter / admin | 본인 reporter | admin | 서버 only |
| trust_score_history | 본인 / admin | 서버 only | 서버 only | 서버 only |
| notification_prefs | 본인 | 본인 | 본인 | 본인 |
| audit_logs | admin | 서버 only | 서버 only | 서버 only |
| waitlist_signups | ✕ | ✕ (서버 admin) | ✕ | ✕ |

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| 다른 사용자 프로필 노출 (nickname, trust_score) | 본 마이그레이션 범위 외 | 매칭 화면 진입 시점에 `users_public_profile` view + grant 로 별도 처리. v1 MVP에서는 서버 엔드포인트 join 응답으로 충분. |
| `to authenticated` 명시 | 모든 정책 | 익명 우회 차단 명시화. anon 정책은 0개. |
| service_role 사용처 | 서버 admin client (매칭 엔진/결제 webhook/waitlist) | RLS 우회는 서버 코드의 단일 진입점에서만. 클라이언트에는 publishable 키만. |
| 회원 탈퇴 (F-AUTH-04) | 미해결 | `auth.users` 삭제 → cascade vs `users.deleted_at` soft delete 결정 필요. RLS 정책은 status='withdrawn' 처리 미포함. |

---

## 검증 (사용자 액션)

```bash
cd /Users/nakjun/app/choirj91-git/앱출시-테스터모집/tester-match/03-output
supabase db push
```

적용 후 Supabase Dashboard → SQL Editor 에서 빠른 검증:

```sql
-- 본인 row 보임
select id, email from public.users;  -- 자기 row 1개

-- 다른 사용자 row 차단 (시드 더미 사용자)
select count(*) from public.users where email like '%testermatch.local';  -- 0

-- waitlist 차단
select count(*) from public.waitlist_signups;  -- 0 (서버 admin 으로만 접근 가능)

-- apps 'matching' 은 보임 (시드 데이터 없으면 0)
select count(*) from public.apps where status = 'matching';
```

서버 admin client 는 RLS 우회 → `/api/waitlist` 정상 작동해야 함 (회귀 테스트).

---

## 미완료 / 후속

- [ ] `users_public_profile` view (매칭 화면 진입 시)
- [ ] 회원 탈퇴 정책 — `status='withdrawn'` 시 본인 SELECT 도 차단할지 결정
- [ ] RLS 단위 테스트 (Supabase CLI `db lint` 또는 `pgTAP`)
- [ ] admin role 부여 절차 SOP — Supabase SQL Editor 직접 UPDATE? 별도 관리자 페이지?
