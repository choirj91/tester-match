-- 2026-10-03 (5): 마켓 정산·종결 (플로우 감사 반영, ADR-0012 부록 B)
--
-- 원칙: 완주한 시트만 과금. 미충원(결제 7일)·충원 마감 후 이탈·이의 인용 시트는 환불.
--   크레딧 결제 → 원장 자동 환급 (시트 단위 멱등키)
--   토스 결제   → refund_due_krw 에 누적, 관리자가 토스에서 부분취소 후 [환불 완료] 처리

alter table public.paid_tester_orders
  add column if not exists refund_due_krw int not null default 0 check (refund_due_krw >= 0),
  add column if not exists refunded_krw   int not null default 0 check (refunded_krw >= 0);

create unique index if not exists credits_ledger_paid_seat_refund_uq
  on public.credits_ledger (ref_id) where type = 'refund' and ref_type = 'paid_seat_refund';
create unique index if not exists credits_ledger_paid_order_unfilled_uq
  on public.credits_ledger (ref_id) where type = 'refund' and ref_type = 'paid_order_unfilled';

alter table public.seat_rewards
  add column if not exists dispute_category text
    check (dispute_category is null or dispute_category in ('not_my_app', 'duplicate', 'prohibited'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted', 'weekly_hot',
    'paid_seat_open', 'redemption_done', 'seat_reward', 'seat_issue', 'tester_request'
  ));
