-- Check of public.member_gain_report (migration 20261009000001) with throwaway fixture rows.
-- Everything runs in one transaction and ends with ROLLBACK — nothing is left behind.
-- Run on the local disposable database only:
--
--     psql -h 127.0.0.1 -d testermatch -X -v ON_ERROR_STOP=1 -f 03-output/supabase/checks/member_gain_report.sql
--
-- The window is in 2001 so existing local rows never fall inside it. A failed check raises an
-- exception (non-zero exit); success prints "member_gain_report: all checks passed".

\set ON_ERROR_STOP 1
begin;

insert into public.users (email, nickname)
values ('gain-check-a@example.test', '가 <b>&닉'),
       ('gain-check-b@example.test', 'gain-b'),
       ('gain-check-c@example.test', 'gain-c')
returning id as user_id;

select (select id from public.users where email = 'gain-check-a@example.test') as a,
       (select id from public.users where email = 'gain-check-b@example.test') as b,
       (select id from public.users where email = 'gain-check-c@example.test') as c
\gset

-- window [2001-01-05 13:00 UTC, 2001-01-12 13:00 UTC) = Fri 22:00 KST → next Fri 22:00 KST
insert into public.credits_ledger (user_id, amount, balance_after, type, ref_type, created_at) values
  -- A: start edge counts, end edge and just-before-start do not, decreases do not
  (:a,   600,   600, 'earn',   'paid_seat',  '2001-01-05 13:00:00+00'),
  (:a,  1100,  1700, 'refund', 'redemption', '2001-01-06 00:00:00+00'),
  (:a, -1100,   600, 'spend',  'redemption', '2001-01-07 00:00:00+00'),
  (:a,   999,  1599, 'earn',   'paid_seat',  '2001-01-12 13:00:00+00'),
  (:a,    50,    50, 'earn',   'paid_seat',  '2001-01-05 12:59:59.999999+00'),
  -- B: two earn rows merge into one type, larger total ranks first
  (:b,  2100,  2100, 'earn',   'paid_seat',  '2001-01-08 00:00:00+00'),
  (:b,   100,  2200, 'earn',   'paid_seat',  '2001-01-09 00:00:00+00'),
  -- C: only a decrease — not listed under credit
  (:c,  -500,  -500, 'adjust', null,         '2001-01-08 00:00:00+00');

insert into public.trust_score_history (user_id, delta, score_after, reason, ref_type, created_at) values
  (:a,   1,  51, 'reward.checkin',     'match', '2001-01-06 00:00:00+00'),
  (:a,   1,  52, 'reward.checkin',     'match', '2001-01-07 00:00:00+00'),
  (:a,   1,  53, 'reward.checkin',     'match', '2001-01-08 00:00:00+00'),
  (:a, -10,  43, 'penalty.no_checkin', 'match', '2001-01-09 00:00:00+00'),
  (:a,  10,  53, 'reward.referral',    null,    '2001-01-10 00:00:00+00'),
  -- B: only at the end edge — excluded
  (:b,   5,  55, 'admin.adjust',       'admin', '2001-01-12 13:00:00+00'),
  -- C: just before the end edge — included
  (:c,   1,  51, 'reward.checkin',     'match', '2001-01-12 12:59:59.999999+00');

-- read the way the app does: as service_role (does not bypass RLS here or in production)
set local role service_role;
create temp table got on commit drop as
  select row_number() over () as pos, r.*
    from public.member_gain_report('2001-01-05 13:00:00+00', '2001-01-12 13:00:00+00') r;
reset role;

create temp table want (pos bigint, kind text, user_id bigint, nickname text, gained bigint, entries integer, detail text)
  on commit drop;
insert into want values
  (1, 'credit', :b, 'gain-b',    2200, 2, 'earn 2,200'),
  (2, 'credit', :a, '가 <b>&닉', 1700, 2, 'refund 1,100 · earn 600'),
  (3, 'trust',  :a, '가 <b>&닉',   13, 4, 'reward.referral 10 · reward.checkin 3'),
  (4, 'trust',  :c, 'gain-c',       1, 1, 'reward.checkin 1');

do $$
declare
  diff integer;
begin
  select count(*) into diff from (
    (select * from got except select * from want)
    union all
    (select * from want except select * from got)
  ) d;
  if diff <> 0 then
    raise exception 'member_gain_report: % row(s) differ from the expected result (order included)', diff;
  end if;
end $$;

-- an empty window returns no rows (not an error)
do $$
begin
  if exists (select 1 from public.member_gain_report('2001-01-12 13:00:00+00', '2001-01-12 13:00:00+00')) then
    raise exception 'member_gain_report: empty window returned rows';
  end if;
end $$;

-- API roles cannot call it
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_function_privilege(r, 'public.member_gain_report(timestamptz, timestamptz)', 'execute') then
      raise exception 'member_gain_report: % can execute it', r;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.member_gain_report(timestamptz, timestamptz)', 'execute') then
    raise exception 'member_gain_report: service_role cannot execute it';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.member_gain_report(timestamptz, timestamptz)'::regprocedure) then
    raise exception 'member_gain_report: must be SECURITY INVOKER';
  end if;
end $$;

select 'member_gain_report: all checks passed' as result;
rollback;
