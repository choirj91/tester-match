-- =====================================================================
-- Tester Match — Supabase Auth 연결 (ADR-0004)
-- 작성일: 2026-05-04
-- 목적:
--   1. public.users 에 auth.users(id) 참조 컬럼 추가
--   2. auth.users insert 시 public.users 자동 생성 (email/google_id/nickname 매핑)
-- =====================================================================

-- 1) auth_user_id FK 추가
alter table public.users
  add column auth_user_id uuid unique references auth.users(id) on delete cascade;

create index users_auth_user_id_idx on public.users (auth_user_id);

-- 2) auth.users → public.users 자동 동기화 트리거
-- security definer + 고정 search_path 로 권한 경계 명확화.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_nickname text;
begin
  derived_nickname := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.users (
    auth_user_id,
    email,
    google_id,
    nickname,
    terms_agreed_at,
    privacy_agreed_at
  ) values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'sub',
    derived_nickname,
    now(),
    now()
  )
  on conflict (email) do update
    set
      -- 기존 row 가 다른 auth_user_id 와 이미 연결돼 있으면 보존(계정 탈취 방지).
      auth_user_id = case
        when public.users.auth_user_id is null then excluded.auth_user_id
        else public.users.auth_user_id
      end,
      google_id = coalesce(public.users.google_id, excluded.google_id),
      nickname  = coalesce(public.users.nickname, excluded.nickname);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =====================================================================
-- 후속 마이그레이션에서 추가 예정:
--   - RLS 정책 (per-table, auth_user_id 기반)
--   - F-AUTH-04 명시적 약관 동의 UX → terms_agreed_at 갱신 흐름
-- =====================================================================
