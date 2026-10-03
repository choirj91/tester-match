-- 2026-10-03 (3): 유료 시트 보상 에스크로 (ADR-0012 부록 A)
--
-- 완주 시 보상을 즉시 적립하지 않고 seat_rewards 에 '보류(held)' 로 건다.
-- 구매자 확정 → released (원장 earn), 이의 → disputed (관리자 판정), 3일 무응답 → 자동 확정.
-- 보상액 = 50 크레딧 × 스크린샷 체크인 일수 (최소 12일).

create table public.seat_rewards (
  id              bigint generated always as identity primary key,
  match_id        bigint not null unique references public.matches(id) on delete restrict,
  order_id        bigint not null references public.paid_tester_orders(id) on delete restrict,
  tester_user_id  bigint not null references public.users(id) on delete restrict,
  amount          int    not null check (amount > 0),
  checkin_days    int    not null check (checkin_days between 1 and 14),
  status          text   not null default 'held'
                    check (status in ('held', 'released', 'disputed', 'forfeited')),
  held_at         timestamptz not null default now(),
  release_due_at  timestamptz not null,          -- held_at + 3일: 구매자 무응답 시 자동 확정 시각
  settled_at      timestamptz,
  settled_by      text check (settled_by in ('buyer', 'auto', 'admin')),
  dispute_reason  text,
  disputed_at     timestamptz,
  admin_note      text
);
create index seat_rewards_status_due_idx on public.seat_rewards (status, release_due_at);
create index seat_rewards_order_idx on public.seat_rewards (order_id);
create index seat_rewards_tester_idx on public.seat_rewards (tester_user_id, held_at desc);
alter table public.seat_rewards enable row level security;
comment on table public.seat_rewards is
  'ADR-0012 부록 A — 유료 시트 보상 에스크로. released 전이 시에만 credits_ledger earn(paid_seat) 기록.';

-- 구매 전 유의사항 동의 시각
alter table public.paid_tester_orders
  add column if not exists consented_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted', 'weekly_hot',
    'paid_seat_open', 'redemption_done', 'seat_reward'
  ));
