-- =====================================================================
-- Tester Match — users_protect_admin_fields 트리거 수정
-- 작성일: 2026-05-05
-- 변경:
--   - SECURITY DEFINER 제거 → INVOKER (current_user = 세션 role 정확 반영)
--   - service_role / supabase_admin / postgres 시스템 컨텍스트는 보호 우회
--   - 일반 인증 사용자는 기존대로 role/trust_score/status 변경 차단
-- 이유:
--   F-CHK-06 페널티 sweep 등 cron 이 admin client(service_role) 로 trust_score
--   를 조정하는데, 기존 SECURITY DEFINER 트리거가 변경을 silently 원복하던 문제.
-- =====================================================================

create or replace function public.users_protect_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 시스템 컨텍스트 (cron / admin client / 마이그레이션): 보호 우회
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  -- admin role 사용자: 우회
  if public.is_admin() then
    return new;
  end if;
  -- 일반 사용자: 보호 필드 원복
  new.role        := old.role;
  new.trust_score := old.trust_score;
  new.status      := old.status;
  return new;
end;
$$;
