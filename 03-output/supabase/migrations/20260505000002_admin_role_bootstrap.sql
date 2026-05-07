-- =====================================================================
-- Tester Match — admin role bootstrap fix
-- 작성일: 2026-05-05
-- 목적:
--   users_protect_admin_fields 트리거가 SQL Editor/service_role 업데이트까지
--   비-admin 사용자 업데이트로 오인해 role/status/trust_score 를 원복하는 문제 수정.
--
-- 원칙:
--   - authenticated 일반 사용자는 기존처럼 보호 컬럼 변경 불가
--   - 이미 admin 인 사용자는 보호 컬럼 관리 가능
--   - SQL Editor/postgres 및 서버 service_role 은 운영자 경로로 허용
-- =====================================================================

create or replace function public.users_protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if jwt_role = 'service_role'
     or session_user::text in ('postgres', 'supabase_admin')
     or public.is_admin()
  then
    return new;
  end if;

  new.role        := old.role;
  new.trust_score := old.trust_score;
  new.status      := old.status;
  return new;
end;
$$;

