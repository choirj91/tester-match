-- 2026-10-04 (23): 회원 행 연결 규칙 보강 (ADR-0013 보강)
--
-- 배경: 000008/000020 은 auth.users INSERT 시점(이메일 확인 전)에 public.users 행을 만들거나
-- 같은 이메일의 사전등록(일괄 등록 placeholder) 행에 연결했다. 그 결과
--   1) 확인되지 않은 가입이 남의 사전등록 행을 선점하고 카카오톡 닉네임까지 써넣을 수 있었고,
--   2) users.auth_user_id 가 on delete cascade 라서, 그 미확인 계정을 지우면
--      (가입 메일 발송 실패 시 정리 등) 사전등록 행과 그 앱까지 함께 지워질 수 있었다.
--   3) 이메일·비밀번호 가입이 사전등록 행을 가져갈 수 있었다 — 남의 주소로 가입해 두고
--      주인이 인증 메일을 누르게 만들면, 가입자가 정한 비밀번호로 그 행에 들어갈 수 있다.
--   4) 사용자 메타데이터의 iss·sub 는 가입자가 직접 써넣을 수 있는 값인데 Google 판별에 쓰였다.
--   5) 다른 로그인에 이미 연결된 행에도 google_id·카카오톡 닉네임을 채워 넣었다.
--   6) 같은 google_id 를 가진 행이 다른 이메일로 있으면 unique 위반으로 로그인 자체가 실패했다.
--
-- 규칙
--   - 제공자와 무관하게 email_confirmed_at 이 채워진 뒤에만 회원 행을 만들거나 연결한다.
--     (Google 로그인은 같은 트랜잭션 안에서 확인 처리되므로 사용자가 느끼는 차이는 없다.)
--   - Google 여부는 서버만 쓸 수 있는 값(app metadata, auth.identities)으로만 판단한다.
--   - 트리거는 Google 로그인만 회원으로 만든다. 이메일·비밀번호 가입의 회원 행은 우리 서버의
--     가입 확인 단계가 비밀번호를 저장한 뒤 public.create_email_member 로 만든다. 공개 가입 API 로
--     직접 만든 계정은 인증돼도 회원 행이 생기지 않는다.
--   - 사전등록 행은 Google 로그인만 가져간다. 그 Google 계정의 이메일이 같아야 한다.
--   - Google 로그인인데 비밀번호가 남아 있으면(비밀번호를 아는 사람이 따로 있을 수 있다) 트리거는
--     회원 행을 만들지도 연결하지도 않는다. 서버 복구 경로가 비밀번호를 지운 뒤 처리한다.
--   - 사전등록 행에 연결될 때 약관·개인정보 동의 시각을 연결 시점으로 기록한다.
--   - 이미 다른 로그인에 연결된 행은 어떤 값도 바꾸지 않는다.
--   - google_id 가 이미 다른 행에 있으면 비워 두고 진행한다 (로그인을 막지 않는다).
--   - 어떤 경우에도 예외로 로그인을 막지 않는다 (트리거는 모든 오류를 경고로 남기고 넘어간다).
--
-- 복구 경로: public.ensure_member_row(uuid) — Google 로그인 콜백(서버, service_role)이
-- 회원 행이 없는 로그인을 발견했을 때 호출한다. 서버가 방금 Google 로그인을 확인한 뒤이므로
-- 남아 있는 비밀번호를 지우고 연결한다.

-- 사전 점검: 함수 소유자(이 마이그레이션을 실행하는 역할)가 auth 테이블을 읽을 수 있어야 한다.
-- 못 읽으면 여기서 실패해 아무것도 적용되지 않는다.
do $$
begin
  if not has_table_privilege('auth.users', 'select')
     or not has_table_privilege('auth.users', 'update')
     or not has_table_privilege('auth.identities', 'select') then
    raise exception 'missing privileges on auth tables for %', current_user;
  end if;
  -- 행 수준 보안이 켜져 있으면, 우회 권한이 없는 역할에게는 모든 행이 안 보인다 (오류 없이 0건).
  if (select relrowsecurity from pg_class where oid = 'auth.users'::regclass)
     and not (select rolbypassrls or rolsuper from pg_roles where rolname = current_user) then
    raise exception 'row level security would hide auth.users from %', current_user;
  end if;
  perform 1 from auth.users limit 1;
  perform 1 from auth.identities limit 1;
end;
$$;

-- 핵심 로직. p_trusted = true 는 서버가 방금 Google 로그인을 확인했다는 뜻이다.
-- 결과를 글자로 돌려준다 (진단용):
--   no_login / unconfirmed / already_linked / not_member / password_present /
--   linked / kept_unlinked / conflict
create or replace function public.link_auth_user(p_auth_user_id uuid, p_trusted boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users%rowtype;
  v_provider text;
  v_identity jsonb;
  v_identity_sub text;
  v_identity_email text;
  v_has_google boolean;
  v_is_anonymous boolean;
  v_email_matches boolean;
  v_can_claim boolean;
  v_google_id text;
  v_nickname text;
  v_linked_id bigint;
begin
  select * into u from auth.users where id = p_auth_user_id;
  if not found or nullif(btrim(u.email), '') is null then
    return 'no_login';
  end if;

  -- 이메일이 확인되기 전에는 어떤 로그인도 회원 행을 만들거나 연결하지 않는다.
  if u.email_confirmed_at is null then
    return 'unconfirmed';
  end if;

  if exists (select 1 from public.users where auth_user_id = u.id) then
    return 'already_linked';
  end if;

  v_provider := coalesce(u.raw_app_meta_data->>'provider', '');
  v_is_anonymous := coalesce((to_jsonb(u)->>'is_anonymous')::boolean, false);

  -- Google 로그인 여부 — 서버만 쓸 수 있는 값으로만 판단한다. 조회가 실패해도 로그인을 막지 않는다.
  begin
    select i.identity_data
      into v_identity
      from auth.identities i
     where i.user_id = u.id and i.provider = 'google'
     limit 1;
  exception when others then
    v_identity := null;
  end;
  v_identity_sub := v_identity->>'sub';
  v_identity_email := v_identity->>'email';

  v_has_google :=
    v_provider = 'google'
    or coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb) ? 'google'
    or v_identity_sub is not null;

  -- 여기서는 Google 로그인만 회원으로 만든다. 이메일·비밀번호 가입은 create_email_member 가 만든다.
  if not v_has_google then
    return 'not_member';
  end if;

  -- 사전등록 행을 가져갈 자격: Google 계정의 이메일이 이 로그인의 이메일과 같아야 한다.
  -- identities 행이 아직 없을 수 있는 가입 순간(트리거)에는 provider 로 판단하지만,
  -- 서버 복구 경로에서는 identities 로 확인된 경우만 인정한다.
  v_email_matches := case
    when v_identity_email is not null then lower(v_identity_email) = lower(u.email)
    else not p_trusted
  end;
  v_can_claim := v_has_google and not v_is_anonymous and v_email_matches;

  -- Google 로그인인데 비밀번호가 남아 있다 — 누가 넣었는지 모르는 비밀번호다 (공개 가입 API 로 먼저
  -- 만들어 둔 계정을 Google 로그인이 이어받은 경우 등). 그대로 회원이 되면 그 비밀번호를 아는 사람과
  -- 계정을 같이 쓰게 된다. 서버가 Google 로그인을 확인한 경로에서만 비밀번호를 지우고 진행한다.
  if v_has_google and coalesce(u.encrypted_password, '') <> '' then
    if not (p_trusted and v_can_claim) then
      return 'password_present';
    end if;
    begin
      update auth.users set encrypted_password = '' where id = u.id;
    exception when others then
      return 'password_present';
    end;
  end if;

  v_google_id := coalesce(
    v_identity_sub,
    case when v_provider = 'google' then u.raw_user_meta_data->>'sub' end
  );
  -- 같은 google_id 가 다른 이메일의 행에 이미 있으면 unique 위반이 난다 — 비워 둔다.
  -- (같은 이메일의 행이 갖고 있는 경우는 아래 coalesce 가 기존 값을 유지한다.)
  if v_google_id is not null
     and exists (select 1 from public.users where google_id = v_google_id) then
    v_google_id := null;
  end if;

  -- 이름은 Google 이 준 값만 쓴다. identities 행이 아직 없는 가입 순간에는 GoTrue 가 Google 프로필로
  -- 채운 사용자 메타데이터를 쓴다 (provider 가 google 인 계정은 가입 때 그 값으로 만들어진다).
  v_nickname := coalesce(
    nullif(left(btrim(coalesce(v_identity->>'full_name', '')), 32), ''),
    nullif(left(btrim(coalesce(v_identity->>'name', '')), 32), ''),
    case when v_provider = 'google' then
      nullif(left(btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), 32), '')
    end,
    left(split_part(u.email, '@', 1), 32)
  );

  begin
    insert into public.users (
      auth_user_id, email, google_id, nickname, kakao_nickname, terms_agreed_at, privacy_agreed_at
    ) values (
      u.id, u.email, v_google_id, v_nickname, null, now(), now()
    )
    on conflict (email) do update
      set
        auth_user_id = excluded.auth_user_id,
        google_id = coalesce(public.users.google_id, excluded.google_id),
        nickname = coalesce(public.users.nickname, excluded.nickname),
        kakao_nickname = coalesce(public.users.kakao_nickname, excluded.kakao_nickname),
        terms_agreed_at = excluded.terms_agreed_at,
        privacy_agreed_at = excluded.privacy_agreed_at
      -- 같은 이메일의 행이 이미 있을 때:
      --   다른 로그인과 연결돼 있으면 건드리지 않는다 (계정 탈취 방지).
      --   연결이 없는 사전등록 행은 자격이 있는 Google 로그인만 가져간다.
      where public.users.auth_user_id is null and v_can_claim
    returning id into v_linked_id;
  exception when unique_violation then
    raise warning 'link_auth_user: unique conflict for login %', u.id;
    return 'conflict';
  end;

  if v_linked_id is null then
    -- 같은 이메일의 회원 행이 이미 있고 이 로그인은 그 행을 가져갈 수 없다 — 회원 행 없는 로그인이 된다
    raise warning 'link_auth_user: login % left without a member row', u.id;
    return 'kept_unlinked';
  end if;
  return 'linked';
end;
$$;

-- 트리거 함수와 복구 함수(둘 다 소유자 권한으로 실행)만 부른다 — API 역할은 누구도 직접 부를 수 없다.
revoke execute on function public.link_auth_user(uuid, boolean)
  from public, anon, authenticated, service_role;

-- 트리거: 가입(INSERT)과 이메일 확인(UPDATE) 때 실행된다. 비밀번호를 건드리지 않는 보수적 경로.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 여기서 나는 오류가 가입·로그인 자체를 실패시키면 안 된다. 연결이 안 된 Google 로그인은
  -- 로그인 콜백의 복구 경로가 다시 처리한다.
  begin
    perform public.link_auth_user(new.id, false);
  exception when others then
    raise warning 'handle_new_auth_user failed for %: % (%)', new.id, sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- 이메일 가입의 회원 행 — 가입 확인 단계(서버, service_role)가 비밀번호를 저장한 뒤 호출한다.
-- 닉네임은 메일의 링크를 연 사람이 확인 화면에서 입력한 값이다. 새 행만 만든다:
-- 같은 이메일의 행이 이미 있으면(사전등록 행 포함) 아무것도 가져가지 않는다.
-- 결과: no_login / unconfirmed / already_linked / email_taken / linked
create or replace function public.create_email_member(
  p_auth_user_id uuid,
  p_nickname text,
  p_kakao_nickname text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users%rowtype;
  v_nickname text;
  v_linked_id bigint;
begin
  select * into u from auth.users where id = p_auth_user_id;
  if not found or nullif(btrim(u.email), '') is null then
    return 'no_login';
  end if;
  if u.email_confirmed_at is null then
    return 'unconfirmed';
  end if;
  if exists (select 1 from public.users where auth_user_id = u.id) then
    return 'already_linked';
  end if;

  v_nickname := coalesce(
    nullif(left(btrim(coalesce(p_nickname, '')), 32), ''),
    left(split_part(u.email, '@', 1), 32)
  );

  begin
    insert into public.users (
      auth_user_id, email, nickname, kakao_nickname, terms_agreed_at, privacy_agreed_at
    ) values (
      u.id,
      u.email,
      v_nickname,
      nullif(left(btrim(coalesce(p_kakao_nickname, '')), 40), ''),
      now(),
      now()
    )
    on conflict (email) do nothing
    returning id into v_linked_id;
  exception when unique_violation then
    return 'email_taken';
  end;

  if v_linked_id is null then
    return 'email_taken';
  end if;
  return 'linked';
end;
$$;

revoke execute on function public.create_email_member(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_email_member(uuid, text, text) to service_role;

-- 서버 복구 경로: Google 로그인 콜백이 회원 행 없는 로그인을 발견했을 때 호출한다 (service_role 전용).
create or replace function public.ensure_member_row(p_auth_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select public.link_auth_user(p_auth_user_id, true);
$$;

revoke execute on function public.ensure_member_row(uuid) from public, anon, authenticated;
grant execute on function public.ensure_member_row(uuid) to service_role;

-- 확인이 확정되는 순간(미확인 → 확인) 연결한다.
-- auth.users 는 로그인마다 쓰이는 테이블이라 잠금을 오래 기다리지 않는다. DROP TRIGGER 는
-- ACCESS EXCLUSIVE 잠금을 잡으므로 쓰지 않고, 없을 때만 만든다 (재실행 안전).
set lock_timeout = '3s';
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_email_confirmed' and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_email_confirmed
      after update on auth.users
      for each row
      when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
      execute function public.handle_new_auth_user();
  end if;
end;
$$;
reset lock_timeout;
