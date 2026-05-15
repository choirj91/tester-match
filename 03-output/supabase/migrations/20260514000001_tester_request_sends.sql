-- 2026-05-14: 테스터 요청 발송 이력
-- 앱 소유자가 다른 사용자에게 테스터 참여 요청 이메일을 보낸 기록.
-- - 하루(24h 롤링) 30명 한도 적용
-- - 동일 앱×수신자에게 중복 발송 방지

create table public.tester_request_sends (
  id                bigint generated always as identity primary key,
  sender_user_id    bigint not null references public.users(id) on delete cascade,
  recipient_user_id bigint not null references public.users(id) on delete cascade,
  app_id            bigint not null references public.apps(id) on delete cascade,
  sent_at           timestamptz not null default now()
);

-- 동일 앱×발신자×수신자 중복 방지
create unique index tester_request_sends_uniq
  on public.tester_request_sends (sender_user_id, recipient_user_id, app_id);

-- 일일 한도 조회용
create index tester_request_sends_daily_idx
  on public.tester_request_sends (sender_user_id, sent_at desc);

alter table public.tester_request_sends enable row level security;

-- 본인 발송 기록만 조회 가능
create policy "본인 발송 기록 조회"
  on public.tester_request_sends for select
  using (sender_user_id = public.current_app_user_id());
