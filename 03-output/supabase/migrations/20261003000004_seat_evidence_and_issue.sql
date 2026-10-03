-- 2026-10-03 (4): 스크린샷 중복 차단용 해시 + 설치 불가 신고 알림 타입 (플로우 감사 반영)

alter table public.checkins
  add column if not exists screenshot_hash text;
create index if not exists checkins_match_hash_idx
  on public.checkins (match_id, screenshot_hash) where screenshot_hash is not null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted', 'weekly_hot',
    'paid_seat_open', 'redemption_done', 'seat_reward', 'seat_issue'
  ));
