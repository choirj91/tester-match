-- 2026-08-15: 월간 랭킹 크레딧 보상 (policy/ranking-rewards.md v1) + 신뢰도 체크인 소급
--
-- 1) ranking_rewards — 월간 수상 기록 (멱등 가드: 월+유저 / 월+순위 unique)
-- 2) notifications.type 에 'reward_granted' 추가
-- 3) 신뢰도 소급: 시행일(07-24) 이전 체크인 +1 일괄 반영
--    이중지급 차단: 유저별 (전체 체크인 수 − reward.checkin 가점 합계) 차액만 지급

-- ── 1. ranking_rewards ────────────────────────────────────────────────
create table public.ranking_rewards (
  id            bigint generated always as identity primary key,
  reward_month  date   not null,                    -- 대상 월 1일 (KST)
  user_id       bigint not null references public.users(id) on delete cascade,
  rank          int    not null check (rank between 1 and 3),
  completed     int    not null check (completed > 0),  -- 당월 완주 수 스냅샷
  amount        int    not null check (amount > 0),
  granted_by    bigint references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (reward_month, user_id),
  unique (reward_month, rank)
);

alter table public.ranking_rewards enable row level security;
-- 공개 페이지(지난달 수상자)는 admin client 로 조회 — anon 정책 불필요

-- ── 2. notifications type 확장 ────────────────────────────────────────
-- 주의: 실DB 에는 CHECK 원본 목록 밖 타입(group_upgrade, boost_expiring,
-- boost_expired)이 이미 존재 — 재생성 목록에 전부 포함해야 add 가 통과한다.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted'
  ));

-- ── 3. 신뢰도 체크인 소급 (일회성 데이터 보정) ────────────────────────
-- 마이그레이션은 postgres 세션 — 트리거의 service_role 예외에 안 걸리므로 잠시 해제
alter table public.users disable trigger users_protect_admin_fields_trg;

do $$
declare
  r record;
  new_score int;
begin
  for r in (
    with checkin_counts as (
      select m.tester_user_id as user_id, count(*)::int as cnt
      from public.checkins c
      join public.matches m on m.id = c.match_id
      group by 1
    ),
    rewarded as (
      select user_id, coalesce(sum(delta), 0)::int as cnt
      from public.trust_score_history
      where reason = 'reward.checkin'
      group by 1
    )
    select cc.user_id, (cc.cnt - coalesce(rw.cnt, 0)) as d
    from checkin_counts cc
    left join rewarded rw using (user_id)
    join public.users u on u.id = cc.user_id and u.deleted_at is null
    where cc.cnt - coalesce(rw.cnt, 0) > 0
  ) loop
    update public.users
       set trust_score = least(1000, greatest(0, trust_score + r.d))
     where id = r.user_id
     returning trust_score into new_score;

    -- 소급분은 1건으로 합산 기록. reason 을 reward.checkin 으로 두어
    -- 위 rewarded 집계에 포함 → 재실행해도 이중지급 없음(멱등).
    insert into public.trust_score_history (user_id, delta, score_after, reason, ref_type)
    values (r.user_id, r.d, new_score, 'reward.checkin', 'admin');
  end loop;
end $$;

alter table public.users enable trigger users_protect_admin_fields_trg;
