-- 2026-10-07: 크레딧 이상 징후 일일 조회 (운영자 요청 — 일일 리포트·Slack 으로 받는다).
--
-- 크레딧은 유료 시트 완주 보상으로만 적립된다(ADR-0014·0017). 그 밖의 경로로 늘었거나,
-- 하루에 너무 많이 늘었거나, 장부가 맞지 않으면 사람이 봐야 한다. 이 함수는 조회만 한다.
--
--   grant_spike     : 기간 안 적립(+) 합이 기준 이상인 회원
--   retired_type    : 폐지된 적립 유형(welcome·charge) 행 — 카드로 크레딧을 사는 경로는 없어야 한다
--   manual_adjust   : 운영자 수동 조정(adjust) 행
--   unknown_earn    : 유료 시트 보상(paid_seat·paid_seat_launch)이 아닌 earn 행
--   duplicate_earn  : 같은 회원·같은 근거(ref)로 earn 이 두 번 이상 (마지막 행이 기간 안)
--   negative_balance: 잔액(장부 합)이 0 미만
--   balance_mismatch: 마지막 행의 balance_after 와 장부 합이 다름
--   large_redemption: 기간 안 교환 신청 합이 기준 이상인 회원
--
-- 회원은 id 로만 돌려준다 (이메일·닉네임·설명 문구 없음 — 리포트가 메일·Slack 으로 나간다).
-- 종류마다 금액 절댓값이 큰 순으로 최대 20행, kind_total 에 그 종류의 전체 행 수를 싣는다
-- (한 종류가 많아도 다른 종류가 밀려 사라지지 않게).

-- 반환 열이 바뀌어도 다시 만들 수 있게 (create or replace 는 반환형을 못 바꾼다)
drop function if exists public.credit_anomaly_report(timestamptz, integer, integer);

create function public.credit_anomaly_report(
  p_since timestamptz,
  p_grant_threshold integer,
  p_redemption_threshold integer
)
returns table (kind text, user_id bigint, amount bigint, detail text, kind_total bigint)
language sql
stable
set search_path = public
as $$
  with recent as (
    select * from credits_ledger where created_at >= p_since
  ),
  totals as (
    select l.user_id,
           sum(l.amount)::bigint as balance,
           (array_agg(l.balance_after order by l.id desc))[1]::bigint as last_after
      from credits_ledger l
     group by l.user_id
  ),
  found (kind, user_id, amount, detail) as (
  select 'grant_spike', r.user_id, sum(r.amount)::bigint, count(*)::text || '건'
    from recent r
   where r.amount > 0 and r.type in ('earn', 'adjust', 'welcome', 'charge')
   group by r.user_id
  having sum(r.amount) >= p_grant_threshold

  union all
  select 'retired_type', r.user_id, r.amount::bigint, r.type || ' #' || r.id
    from recent r
   where r.type in ('welcome', 'charge')

  union all
  select 'manual_adjust', r.user_id, r.amount::bigint, '#' || r.id
    from recent r
   where r.type = 'adjust'

  union all
  select 'unknown_earn', r.user_id, r.amount::bigint, coalesce(r.ref_type, '-') || ' #' || r.id
    from recent r
   where r.type = 'earn'
     and coalesce(r.ref_type, '') not in ('paid_seat', 'paid_seat_launch')

  union all
  select 'duplicate_earn', l.user_id, sum(l.amount)::bigint, l.ref_type || ':' || l.ref_id || ' ×' || count(*)
    from credits_ledger l
   where l.type = 'earn' and l.amount > 0 and l.ref_id is not null
   group by l.user_id, l.ref_type, l.ref_id
  having count(*) > 1 and max(l.created_at) >= p_since

  union all
  select 'negative_balance', t.user_id, t.balance, ''
    from totals t
   where t.balance < 0

  union all
  select 'balance_mismatch', t.user_id, t.balance, '마지막 기록 ' || t.last_after
    from totals t
   where t.last_after is distinct from t.balance

  union all
  select 'large_redemption', c.user_id, sum(c.amount)::bigint, count(*)::text || '건'
    from credit_redemptions c
   where c.created_at >= p_since
   group by c.user_id
  having sum(c.amount) >= p_redemption_threshold
  ),
  ranked as (
    select f.*,
           row_number() over (partition by f.kind order by abs(f.amount) desc, f.user_id) as rn,
           count(*) over (partition by f.kind) as kind_total
      from found f
  )
  select kind, user_id, amount, detail, kind_total
    from ranked
   where rn <= 20
   order by kind, rn;
$$;

comment on function public.credit_anomaly_report(timestamptz, integer, integer) is
  '크레딧 이상 징후 조회 (읽기 전용) — 일일 관리자 리포트·Slack. 2026-10-07';

-- 회원별 크레딧 내역이 담기므로 API 역할에는 열지 않는다 (서버 service_role 전용)
revoke all on function public.credit_anomaly_report(timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.credit_anomaly_report(timestamptz, integer, integer) to service_role;
