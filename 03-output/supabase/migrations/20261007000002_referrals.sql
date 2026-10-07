-- 2026-10-07 (ADR-0019): 친구 추천 → 신뢰도 보너스 (크레딧 없음)
--
-- 추천 링크로 가입한 회원의 첫 유료 시트 보상이 확정(released)되면 추천인·피추천인 모두 신뢰도 +10.
-- credits_ledger 는 건드리지 않는다 — 크레딧은 유료 시트 보상으로만 적립된다 (ADR-0014·0017).
--
-- 지급 여부는 DB 가 정한다 (grant_referral_reward 한 번의 호출 = 한 트랜잭션). 후보 선정도 DB 함수
-- (referral_reward_candidates) — 서버는 후보 id 를 받아 하나씩 심사 함수에 넘긴다.
--   - 첫 확정 시트를 추천인이나 피추천인 본인이 결제했으면 무효 (자기 결제로 점수 만들기 차단)
--   - 둘 중 하나라도 탈퇴·정지 상태면 무효
--   - 추천인은 90일에 5건까지 — 넘으면 무효 (부계정 여러 개로 부풀리기 상한)
--   무효는 최종 상태다. 다시 심사하지 않으므로 막힌 건이 대기 목록을 차지하지 않는다.
--
-- 다시 실행해도 안전하게 썼다 (운영 반영은 psql 수동 실행 — 기록 테이블이 없다). 데이터를 지우는 문은 없다.

create table if not exists public.referrals (
  -- 다른 테이블과 같은 identity 열 — 별도 시퀀스 권한이 필요 없다
  id               bigint generated always as identity primary key,
  referrer_user_id bigint not null references public.users(id) on delete cascade,
  -- 피추천인은 한 번만 추천될 수 있다
  invitee_user_id  bigint not null unique references public.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  rewarded_at      timestamptz,
  reward_seat_id   bigint references public.seat_rewards(id),
  voided_at        timestamptz,
  void_reason      text,
  constraint referrals_not_self check (referrer_user_id <> invitee_user_id),
  constraint referrals_void_reason_check
    check (void_reason in ('self_purchase', 'inactive', 'referrer_cap')),
  constraint referrals_void_pair check ((voided_at is null) = (void_reason is null)),
  constraint referrals_reward_pair check ((rewarded_at is null) = (reward_seat_id is null)),
  -- 지급과 무효 중 하나로만 끝난다
  constraint referrals_single_outcome check (rewarded_at is null or voided_at is null)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id);
-- 지급 대기 목록 (크론이 id 순으로 훑는다) — 지급·무효로 끝난 행은 빠진다
create index if not exists referrals_pending_idx on public.referrals (id)
  where rewarded_at is null and voided_at is null;

comment on table public.referrals is
  'ADR-0019 친구 추천. 피추천인 첫 유료 시트 확정 시 양쪽 신뢰도 +10 (grant_referral_reward). 크레딧 없음.';
comment on column public.referrals.void_reason is
  'self_purchase: 첫 확정 시트를 추천인·피추천인이 결제 / inactive: 탈퇴·정지 / referrer_cap: 추천인 90일 5건 초과';

-- 서버(service_role)만 읽고 쓴다. 공개 키·사용자 세션에는 어떤 권한도 없다.
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
grant select, insert, update, delete on public.referrals to service_role;
-- 자체 운영 PostgreSQL(ADR-0015)의 service_role 은 RLS 우회 권한이 없다 — 다른 RLS 테이블과 같은
-- 허용 정책이 있어야 서버가 행을 본다 (03-output/infra/azure/db/03-grants.sql 과 같은 이름).
-- Supabase 에서는 service_role 이 RLS 를 우회하므로 영향이 없다.
drop policy if exists service_role_all on public.referrals;
create policy service_role_all on public.referrals
  for all to service_role using (true) with check (true);

-- 초안(로컬에만 적용됐던 2026-10-07 버전)의 지급 함수 — 서버가 시트·증감을 넘기던 형태라 없앤다
drop function if exists public.grant_referral_reward(bigint, bigint, integer);

-- 추천 보너스 심사·지급. 결과:
--   'granted'           양쪽 +10 지급 (rewarded_at, reward_seat_id 기록)
--   'already'           이미 지급·무효로 끝났거나 없는 추천
--   'pending'           피추천인의 확정(released) 유료 시트가 아직 없다 — 아무것도 바꾸지 않는다
--   'voided:<reason>'   무효로 끝냄 (self_purchase | inactive | referrer_cap)
-- 점수는 0~1,000 으로 자르고 원장에는 증감 +10 을 남긴다 (lib/trust.ts applyTrustDelta 와 같은 규칙).
-- users 보호 트리거(users_protect_admin_fields)는 service_role 요청이면 trust_score 변경을 허용한다.
-- 다른 역할이 부르면 트리거가 점수를 되돌리므로, 저장된 점수를 확인해 다르면 전체를 롤백한다
-- (원장만 남고 점수가 안 바뀌던 2026-08-14 사고의 재발 방지).
create or replace function public.grant_referral_reward(p_referral_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- lib/trust.ts REFERRAL_TRUST_DELTA·lib/referrals.ts 상한 상수와 같은 값 (TS 쪽은 화면 문구용)
  c_delta constant integer := 10;
  c_cap constant integer := 5;
  c_cap_window constant interval := interval '90 days';
  v_ref public.referrals%rowtype;
  v_users bigint[];
  v_user bigint;
  v_status text;
  v_deleted_at timestamptz;
  v_inactive boolean := false;
  v_seat_id bigint;
  v_buyer bigint;
  v_recent integer;
  v_reason text;
  v_before integer;
  v_after integer;
  v_saved integer;
begin
  select * into v_ref from public.referrals where id = p_referral_id for update;
  if not found or v_ref.rewarded_at is not null or v_ref.voided_at is not null then
    return 'already';
  end if;

  -- 회원 행은 id 오름차순으로 잠근다 — 서로 추천한 두 회원을 겹친 실행이 반대 순서로 잠가 교착되지 않게.
  -- 상태와 추천인 상한은 잠근 뒤에 읽는다 — 같은 추천인의 지급이 겹쳐도 상한을 함께 넘지 못한다.
  v_users := array[
    least(v_ref.referrer_user_id, v_ref.invitee_user_id),
    greatest(v_ref.referrer_user_id, v_ref.invitee_user_id)
  ];
  foreach v_user in array v_users loop
    select status, deleted_at into v_status, v_deleted_at
      from public.users where id = v_user for update;
    if not found or v_status <> 'active' or v_deleted_at is not null then
      v_inactive := true;
    end if;
  end loop;

  -- 근거는 피추천인의 "첫" 확정 유료 시트 하나다
  select s.id, o.buyer_user_id into v_seat_id, v_buyer
    from public.seat_rewards s
    join public.paid_tester_orders o on o.id = s.order_id
   where s.tester_user_id = v_ref.invitee_user_id
     and s.status = 'released'
   order by s.settled_at asc nulls last, s.id asc
   limit 1;
  if v_seat_id is null then
    return 'pending';
  end if;

  if v_buyer = v_ref.referrer_user_id or v_buyer = v_ref.invitee_user_id then
    v_reason := 'self_purchase';
  elsif v_inactive then
    v_reason := 'inactive';
  else
    select count(*) into v_recent
      from public.referrals
     where referrer_user_id = v_ref.referrer_user_id
       and rewarded_at > now() - c_cap_window;
    if v_recent >= c_cap then
      v_reason := 'referrer_cap';
    end if;
  end if;

  if v_reason is not null then
    update public.referrals set voided_at = now(), void_reason = v_reason where id = v_ref.id;
    return 'voided:' || v_reason;
  end if;

  foreach v_user in array v_users loop
    select trust_score into v_before from public.users where id = v_user;
    v_after := least(1000, greatest(0, v_before + c_delta));

    update public.users set trust_score = v_after where id = v_user
    returning trust_score into v_saved;
    if v_saved is distinct from v_after then
      raise exception 'grant_referral_reward: trust_score update blocked for user %', v_user;
    end if;

    insert into public.trust_score_history (user_id, delta, score_after, reason, ref_type, ref_id)
    values (v_user, c_delta, v_after, 'reward.referral', 'referral', v_ref.id);
  end loop;

  update public.referrals set rewarded_at = now(), reward_seat_id = v_seat_id where id = v_ref.id;
  return 'granted';
end;
$$;

revoke all on function public.grant_referral_reward(bigint) from public, anon, authenticated;
grant execute on function public.grant_referral_reward(bigint) to service_role;

-- 크론의 심사 후보: 대기 추천 중 피추천인에게 확정(released) 유료 시트가 있는 것, id 순, 1~50건.
-- 서버가 대기 목록 앞쪽부터 페이지로 훑으면 유료 시트를 하지 않는 피추천인(이메일 가입자는 유료 시트를
-- 할 수 없다)이 쌓일수록 뒤쪽 추천이 검사되지 않는다 — 조건을 DB 에서 걸어 그런 행을 건너뛴다.
-- 시트 확인은 seat_rewards_tester_idx (tester_user_id, held_at desc) 가 받친다 — 테스터당 시트는 몇 건뿐이다.
-- 호출자 권한으로 실행한다 (service_role 은 두 테이블 모두 service_role_all 정책이 있다).
drop function if exists public.referral_reward_candidates(integer);
create function public.referral_reward_candidates(p_limit integer)
returns setof bigint
language sql
stable
set search_path = public, pg_temp
as $$
  select r.id
    from public.referrals r
   where r.rewarded_at is null
     and r.voided_at is null
     and exists (
       select 1
         from public.seat_rewards s
        where s.tester_user_id = r.invitee_user_id
          and s.status = 'released'
     )
   order by r.id
   limit greatest(1, least(coalesce(p_limit, 1), 50));
$$;

revoke all on function public.referral_reward_candidates(integer) from public, anon, authenticated;
grant execute on function public.referral_reward_candidates(integer) to service_role;

-- 지급 알림 유형 추가 (기존 목록 + referral_reward — 20261004000001_inquiries.sql 기준)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted', 'weekly_hot',
    'paid_seat_open', 'redemption_done', 'seat_reward', 'seat_issue', 'tester_request',
    'inquiry_answered', 'referral_reward'
  ));
