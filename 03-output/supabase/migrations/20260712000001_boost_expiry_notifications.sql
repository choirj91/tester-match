-- 2026-07-12: 급구 자동 만료 + 재방문 유도 알림 타입 확장
-- boost_deadline_at 은 이미 초기 스키마에 존재. 여기서는 notifications type CHECK 만 확장.

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'match_new',
    'match_reminder',
    'match_completed',
    'match_penalized',
    'comment_new',
    'post_comment',
    'boost_expiring',   -- 급구 D-1 (24시간 이내 만료)
    'boost_expired'     -- 급구 만료 → 재활성 유도
  ));
