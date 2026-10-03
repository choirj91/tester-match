-- 2026-10-03: 커뮤니티 테스터 마켓 (ADR-0012)
--
-- 1) matches.paid_order_id — 유료 시트 배정 (시트 완주 시 700 크레딧)
-- 2) paid_order_slots.match_id — 콘솔 슬롯 ↔ 테스터 매칭 연결 (스크린샷 증빙 재사용)
-- 3) payments.provider 에 'credits' (보유 크레딧으로 시트 구매)
-- 4) credit_redemptions — 기프티콘 교환 신청 원장 (관리자 수동 발송)
-- 5) notifications.type 확장 (+ 누락돼 있던 weekly_hot 복구)

-- ── 1. matches.paid_order_id ─────────────────────────────────────────
alter table public.matches
  add column if not exists paid_order_id bigint
    references public.paid_tester_orders(id) on delete set null;
create index if not exists matches_paid_order_idx
  on public.matches (paid_order_id) where paid_order_id is not null;

-- ── 2. paid_order_slots.match_id ─────────────────────────────────────
alter table public.paid_order_slots
  add column if not exists match_id bigint unique
    references public.matches(id) on delete set null;

-- ── 3. payments.provider 확장 ────────────────────────────────────────
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('toss', 'stripe', 'credits'));

-- ── 4. credit_redemptions ────────────────────────────────────────────
create table public.credit_redemptions (
  id            bigint generated always as identity primary key,
  user_id       bigint not null references public.users(id) on delete restrict,
  amount        int    not null check (amount > 0),
  kind          text   not null default 'gifticon' check (kind in ('gifticon')),
  status        text   not null default 'requested'
                  check (status in ('requested', 'done', 'rejected')),
  contact       text   not null default '',   -- 기프티콘 수신 연락처 (휴대폰/카톡)
  note          text   not null default '',   -- 신청자 메모 (원하는 브랜드 등)
  admin_note    text,
  ledger_id     bigint references public.credits_ledger(id) on delete set null,  -- 차감(spend) 행
  processed_by  bigint references public.users(id) on delete set null,
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index credit_redemptions_status_idx
  on public.credit_redemptions (status, created_at desc);
create index credit_redemptions_user_idx
  on public.credit_redemptions (user_id, created_at desc);
alter table public.credit_redemptions enable row level security;
comment on table public.credit_redemptions is
  'ADR-0012 기프티콘 교환 신청. 신청 시 credits_ledger 에 spend 선차감, 거절 시 refund 로 복구.';

-- ── 5. notifications.type ────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted', 'weekly_hot',
    'paid_seat_open', 'redemption_done'
  ));
