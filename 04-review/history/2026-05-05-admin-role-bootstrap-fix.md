# 2026-05-05 — admin role bootstrap 원복 이슈 수정

## 증상

Supabase Dashboard 에서 다음 UPDATE 는 success 로 보이지만 즉시 `role='user'` 로 원복됨.

```sql
update public.users
   set role = 'admin'
 where email = 'choirj91@gmail.com';
```

Table Editor 에서 직접 수정해도 1초 안에 보호 컬럼이 원복됨.

## 원인

`users_protect_admin_fields()` 트리거가 `public.is_admin()` 만 확인했다.

`public.is_admin()` 은 `auth.uid()` 로 현재 사용자의 `public.users.role` 을 조회하는데, SQL Editor / Table Editor / service_role 서버 업데이트에서는 `auth.uid()` 가 비어 있다. 그래서 운영자 경로도 비-admin 으로 판정되고, `role`, `trust_score`, `status` 가 `old` 값으로 조용히 되돌아갔다.

부수 영향:

- 관리자 최초 부여 bootstrap 불가
- `service_role` 서버 코드의 회원 탈퇴 `status='withdrawn'` 갱신도 원복 가능
- 일반 사용자의 권한 상승 차단 자체는 정상 동작

## 수정

신규 마이그레이션:

| 파일 | 역할 |
|---|---|
| `03-output/supabase/migrations/20260505000002_admin_role_bootstrap.sql` | `users_protect_admin_fields()` 교체 |

허용 조건:

- `request.jwt.claim.role = 'service_role'`
- `session_user in ('postgres', 'supabase_admin')`
- `public.is_admin() = true`

그 외 authenticated 사용자는 기존처럼 `role`, `trust_score`, `status` 변경 시도가 원복된다.

## 운영 적용 SQL

Supabase SQL Editor 에서 마이그레이션 SQL을 적용한 뒤 다시 실행:

```sql
update public.users
   set role = 'admin'
 where email = 'choirj91@gmail.com';

select email, role, status, trust_score
from public.users
where email = 'choirj91@gmail.com';
```

기대값: `role = admin`.

## 검증 포인트

- 일반 로그인 사용자: 자기 row 의 `nickname` 변경 가능
- 일반 로그인 사용자: 자기 row 의 `role`, `trust_score`, `status` 변경은 원복
- SQL Editor: 최초 admin 부여 가능
- server `service_role`: 회원 탈퇴 시 `status='withdrawn'` 반영 가능

