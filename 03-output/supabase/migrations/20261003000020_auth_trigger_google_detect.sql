-- 2026-10-03 (20): 가입 트리거의 Google 판별 보강 (000008 후속)
--
-- 000008 은 raw_app_meta_data.provider 만 보고 Google 가입을 판별했는데, 이 값은 생성 경로에
-- 따라 INSERT 시점에 'google' 이 아닐 수 있어 google_id 가 비는 회귀가 가능했다.
-- Google OAuth 가입자의 raw_user_meta_data 에 항상 있는 발급자(iss)도 함께 본다.
-- 번호를 000020 으로 띄운 이유: 같은 날 다른 세션의 순번(000009~)과 겹치지 않게.

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
  is_google :=
    coalesce(new.raw_app_meta_data->>'provider', '') = 'google'
    or coalesce(new.raw_user_meta_data->>'iss', '') ilike '%accounts.google.com%';

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
