-- 2026-05-16: 인앱 알림 시스템
-- 주요 이벤트(테스터 참여·댓글·완주·페널티·D-day)를 사용자별로 저장.

create table public.notifications (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references public.users(id) on delete cascade,
  type            text   not null check (type in (
                    'match_new',        -- 내 앱에 테스터 신규 참여
                    'match_reminder',   -- 테스트 D-day 리마인더 (크론)
                    'match_completed',  -- 14일 완주
                    'match_penalized',  -- 미체크인 페널티
                    'comment_new',      -- 내 앱에 댓글
                    'post_comment'      -- 내 게시글에 댓글
                  )),
  title           text   not null check (char_length(title) <= 100),
  body            text   not null check (char_length(body)  <= 300),
  link            text,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

-- 읽지 않은 알림 빠른 조회
create index notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

-- 본인 알림만 조회
create policy "본인 알림 조회"
  on public.notifications for select
  using (user_id = public.current_app_user_id());

-- 읽음 처리 (본인만)
create policy "본인 알림 읽음 처리"
  on public.notifications for update
  using (user_id = public.current_app_user_id());
