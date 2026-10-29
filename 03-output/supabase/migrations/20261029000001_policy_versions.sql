-- 2026-10-29: 약관·개인정보처리방침 버전과 회원별 동의 기록
--
-- 본문은 앱 코드(03-output/app/src/policies/<kind>/<version>.tsx)에 두고, DB 에는 버전 목록과
-- 그 파일의 SHA-256, 회원이 어느 버전에 언제 동의했는지를 남긴다. 버전 목록은 앱의
-- src/policies/registry.ts 와 같아야 한다 (registry.test.ts 가 이 파일과 대조).
--
-- - policy_versions: 시행 시각이 지난 행은 고치거나 지울 수 없다. 시행 전 개정안만 해시를 고칠 수 있다.
-- - policy_consents: 추가만 한다 (수정 불가). 같은 회원·같은 버전은 한 번만 남는다.
-- - 기존 회원(이 마이그레이션을 처음 실행한 시점에 로그인 계정이 연결된 회원)은 'legacy' 로 2026-10-13 판 동의를 기록한다. 버전 기록이 없던 때
--   가입한 회원이며, 그때 약관 제3조(시행 7일 전 공지)에 따라 현행판이 적용된 것으로 본다.
--   동의 시각은 users.terms_agreed_at / privacy_agreed_at (가입·연결 시각) 그대로다.
--
-- 다시 실행해도 안전하게 썼다 (운영 반영은 psql 수동 실행 — 기록 테이블이 없다). 데이터를 지우는 문은 없다.

create table if not exists public.policy_versions (
  kind           text        not null check (kind in ('terms', 'privacy')),
  version        text        not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  effective_at   timestamptz not null,
  content_sha256 text        not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  primary key (kind, version),
  unique (kind, effective_at)
);

comment on table public.policy_versions is
  '약관·개인정보처리방침 버전. 본문은 앱 src/policies/<kind>/<version>.tsx, content_sha256 은 그 파일의 해시.';

create table if not exists public.policy_consents (
  id         bigint generated always as identity primary key,
  user_id    bigint      not null references public.users(id) on delete cascade,
  kind       text        not null,
  version    text        not null,
  agreed_at  timestamptz not null default now(),
  source     text        not null check (source in ('legacy', 'signup', 'consent_screen')),
  foreign key (kind, version) references public.policy_versions (kind, version),
  unique (user_id, kind, version)
);

comment on table public.policy_consents is
  '회원별 약관 동의 기록 (추가만). legacy: 버전 기록 도입 전 회원 / signup: 이메일 가입 확인 화면 / consent_screen: 로그인 후 동의 화면';

-- 시행된 버전은 바꾸지 못한다 — 동의 기록이 가리키는 원문이 달라지면 안 된다
create or replace function public.policy_versions_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.effective_at <= now() then
    raise exception 'policy version %/% is already in effect and cannot be changed', old.kind, old.version;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists policy_versions_guard on public.policy_versions;
create trigger policy_versions_guard
  before update or delete on public.policy_versions
  for each row execute function public.policy_versions_guard();

create or replace function public.policy_consents_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'policy_consents rows cannot be updated';
end;
$$;

drop trigger if exists policy_consents_append_only on public.policy_consents;
create trigger policy_consents_append_only
  before update on public.policy_consents
  for each row execute function public.policy_consents_append_only();

-- 서버(service_role)는 버전을 읽고, 동의를 읽고 추가만 한다 — 서비스 키가 새도 기록을 고치거나 지우지 못하게.
-- 버전 행은 마이그레이션(소유자)만 쓴다. 공개 키·사용자 세션에는 어떤 권한도 없다.
-- (회원 행 삭제 시 동의 기록의 on delete cascade 는 테이블 소유자 권한으로 돈다)
alter table public.policy_versions enable row level security;
alter table public.policy_consents enable row level security;
revoke all on public.policy_versions, public.policy_consents from anon, authenticated, service_role;
grant select on public.policy_versions to service_role;
grant select, insert on public.policy_consents to service_role;
-- 자체 운영 PostgreSQL(ADR-0015)의 service_role 은 RLS 우회 권한이 없다 (20261007000002 와 같은 이유)
drop policy if exists service_role_all on public.policy_versions;
create policy service_role_all on public.policy_versions
  for all to service_role using (true) with check (true);
drop policy if exists service_role_all on public.policy_consents;
create policy service_role_all on public.policy_consents
  for all to service_role using (true) with check (true);

insert into public.policy_versions (kind, version, effective_at, content_sha256) values
  ('terms', '2026-10-13', '2026-10-13 00:00:00+09', 'eff35b2c75cd9c04079c7085d51fb8b9f72a0cf07b726e4a423def33417ca41d'),
  ('terms', '2026-11-28', '2026-11-28 00:00:00+09', 'd46e43a85dca579bc778b33075d461974ebf9012d876917a72f799f88856a96a'),
  ('privacy', '2026-10-13', '2026-10-13 00:00:00+09', 'ee1843ad010297e6736e854a2bab0c9ce604cd0fa57198dd16675a34a89f31d8')
on conflict (kind, version) do nothing;

-- 기존 회원의 동의 기록 (버전 기록 도입 전 가입). 처음 실행할 때 한 번만 넣는다 — 다시 실행했을 때
-- 그 사이 가입해 아직 동의하지 않은 회원에게 동의 기록이 생기면 안 된다.
-- 로그인한 적 없는 사전등록 행(auth_user_id 없음)은 넣지 않는다 — 주인이 처음 로그인할 때 동의 화면에서 받는다.
insert into public.policy_consents (user_id, kind, version, agreed_at, source)
select u.id, k.kind, '2026-10-13',
       case when k.kind = 'terms' then u.terms_agreed_at else u.privacy_agreed_at end,
       'legacy'
from public.users u
cross join (values ('terms'), ('privacy')) as k(kind)
where u.auth_user_id is not null
  and not exists (select 1 from public.policy_consents where source = 'legacy')
on conflict (user_id, kind, version) do nothing;

-- 회원 동의 기록. 서버가 시행 중인 버전만 넘긴다 — 여기서도 시행 전·없는 버전은 거절한다.
-- 결과: recorded / nothing / bad_source / no_member / not_effective
create or replace function public.record_policy_consents(
  p_auth_user_id uuid,
  p_terms_version text,
  p_privacy_version text,
  p_source text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id bigint;
begin
  if p_source is null or p_source not in ('signup', 'consent_screen') then
    return 'bad_source';
  end if;
  if p_terms_version is null and p_privacy_version is null then
    return 'nothing';
  end if;

  select id into v_user_id from public.users where auth_user_id = p_auth_user_id;
  if v_user_id is null then
    return 'no_member';
  end if;

  if exists (
    select 1
    from (values ('terms', p_terms_version), ('privacy', p_privacy_version)) as t(kind, version)
    where t.version is not null
      and not exists (
        select 1 from public.policy_versions pv
        where pv.kind = t.kind and pv.version = t.version and pv.effective_at <= now()
      )
  ) then
    return 'not_effective';
  end if;

  insert into public.policy_consents (user_id, kind, version, source)
  select v_user_id, t.kind, t.version, p_source
  from (values ('terms', p_terms_version), ('privacy', p_privacy_version)) as t(kind, version)
  where t.version is not null
  on conflict (user_id, kind, version) do nothing;

  return 'recorded';
end;
$$;

revoke execute on function public.record_policy_consents(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_policy_consents(uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
