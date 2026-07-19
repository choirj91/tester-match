-- 2026-07-18: 공용 테스터 그룹 전환 유도 알림 타입 추가

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
    'boost_expiring',
    'boost_expired',
    'group_upgrade'     -- 레거시 앱 → 공용 테스터 그룹 전환 유도
  ));
