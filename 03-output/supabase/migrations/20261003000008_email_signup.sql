-- 2026-10-03 (7): 이메일 회원가입 (ADR-0013)
--
-- 1) users.kakao_nickname — 가입 시 입력(이메일 가입 필수, Google 가입은 프로필에서 선택 입력)
-- 2) handle_new_auth_user — 가입 메타데이터의 nickname/kakao_nickname 반영,
--    google_id 는 Google 로 가입한 경우에만 기록 (이메일 가입의 sub 는 auth uuid 라 구분 필요)

alter table public.users
  add column if not exists kakao_nickname text
    check (kakao_nickname is null or char_length(kakao_nickname) between 1 and 40);

comment on column public.users.kakao_nickname is
  '카카오톡 오픈채팅 닉네임 — 커뮤니티 회원 식별용. 공개 페이지 비노출(운영자만 조회).';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_nickname text;
  kakao text;
  is_google boolean;
begin
  is_google := coalesce(new.raw_app_meta_data->>'provider', '') = 'google';

  derived_nickname := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'nickname'), ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  kakao := nullif(left(btrim(coalesce(new.raw_user_meta_data->>'kakao_nickname', '')), 40), '');

  insert into public.users (
    auth_user_id,
    email,
    google_id,
    nickname,
    kakao_nickname,
    terms_agreed_at,
    privacy_agreed_at
  ) values (
    new.id,
    new.email,
    case when is_google then new.raw_user_meta_data->>'sub' end,
    derived_nickname,
    kakao,
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
      nickname  = coalesce(public.users.nickname, excluded.nickname),
      kakao_nickname = coalesce(public.users.kakao_nickname, excluded.kakao_nickname);

  return new;
end;
$$;
