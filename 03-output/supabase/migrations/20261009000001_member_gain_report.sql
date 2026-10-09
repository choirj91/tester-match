-- 2026-10-09: 회원별 크레딧·신뢰도 증가 내역 (운영자 요청 — 일일·주간 관리자 리포트에서 비정상 증가를 찾는다).
--
-- 기간 [p_since, p_until) 안에서 늘어난 몫만 회원별로 더한다 (줄어든 행은 보지 않는다).
--   credit : credits_ledger.amount > 0 합 — detail 은 유형(type)별 합 "earn 600 · refund 1,100"
--   trust  : trust_score_history.delta > 0 합 — detail 은 사유(reason)별 합 "reward.checkin 4 · reward.referral 10"
-- entries 는 더한 행 수. 닉네임만 싣는다 (이메일 없음 — 리포트가 메일·Slack 으로 나간다).
-- 정렬: kind, gained 큰 순, user_id. 행 수 상한은 두지 않는다 — 합계(회원 수·총량)를 앱이 계산하므로
-- 앱은 PostgREST 1,000행 상한을 range 로 넘겨 모두 읽는다.
--
-- SECURITY INVOKER: 운영(Azure PG + 자가 호스팅 PostgREST)의 service_role 은 RLS 를 우회하지 않는다.
-- credits_ledger·trust_score_history·users 에는 service_role_all 정책이 있어 그대로 읽힌다.

-- 반환 열이 바뀌어도 다시 만들 수 있게 (create or replace 는 반환형을 못 바꾼다)
drop function if exists public.member_gain_report(timestamptz, timestamptz);

create function public.member_gain_report(p_since timestamptz, p_until timestamptz)
returns table (kind text, user_id bigint, nickname text, gained bigint, entries integer, detail text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with parts (kind, user_id, label, amount, n) as (
    select 'credit', l.user_id, l.type, sum(l.amount)::bigint, count(*)::integer
      from credits_ledger l
     where l.amount > 0
       and l.created_at >= p_since
       and l.created_at < p_until
     group by l.user_id, l.type

    union all
    select 'trust', h.user_id, h.reason, sum(h.delta)::bigint, count(*)::integer
      from trust_score_history h
     where h.delta > 0
       and h.created_at >= p_since
       and h.created_at < p_until
     group by h.user_id, h.reason
  ),
  per_user as (
    select p.kind,
           p.user_id,
           sum(p.amount)::bigint as gained,
           sum(p.n)::integer as entries,
           string_agg(p.label || ' ' || to_char(p.amount, 'FM999,999,999,990'), ' · '
                      order by p.amount desc, p.label) as detail
      from parts p
     group by p.kind, p.user_id
  )
  select g.kind, g.user_id, u.nickname, g.gained, g.entries, g.detail
    from per_user g
    left join users u on u.id = g.user_id
   order by g.kind, g.gained desc, g.user_id;
$$;

comment on function public.member_gain_report(timestamptz, timestamptz) is
  '회원별 크레딧·신뢰도 증가 합 (읽기 전용) — 일일·주간 관리자 리포트. 2026-10-09';

-- 회원별 내역·닉네임이 담기므로 API 역할에는 열지 않는다 (서버 service_role 전용)
revoke all on function public.member_gain_report(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.member_gain_report(timestamptz, timestamptz) to service_role;

-- PostgREST 가 새 함수를 보도록 스키마 캐시를 다시 읽게 한다 (듣는 쪽이 없으면 아무 일도 없다)
notify pgrst, 'reload schema';
