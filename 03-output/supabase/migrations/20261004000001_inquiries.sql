-- 2026-10-04 (1): 1:1 문의 — 게시판 "질문" 분류를 대체한다.
-- 본인과 운영자만 열람한다. RLS 를 켜고 정책을 두지 않으며 API 역할의 권한도 회수한다 —
-- 앱 서버(서비스 롤)만 읽고 쓰고, 권한 검사는 서버 코드(lib/inquiries.ts)가 한다.

create table if not exists public.inquiries (
  id                 bigint generated always as identity primary key,
  user_id            bigint not null references public.users(id) on delete cascade,
  category           text not null
    check (category in ('account', 'matching', 'paid', 'credits', 'report', 'other')),
  title              text not null check (char_length(title) between 1 and 120),
  body               text not null check (char_length(body) between 1 and 5000),
  status             text not null default 'open'
    check (status in ('open', 'in_progress', 'answered', 'closed')),
  answer             text check (answer is null or char_length(answer) <= 5000),
  answered_by        bigint references public.users(id) on delete set null,
  answered_at        timestamptz,
  admin_memo         text check (admin_memo is null or char_length(admin_memo) <= 2000),
  -- 운영팀 Slack 알림이 전송된 시각 (null = 미전송 — 관리자 화면에 표시)
  slack_notified_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists inquiries_status_created_idx
  on public.inquiries (status, created_at desc);
create index if not exists inquiries_user_created_idx
  on public.inquiries (user_id, created_at desc);

drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();

-- 도배 방지의 최종 판정 (24시간 5건, 60초 간격). 앱 서버의 사전 검사는 조회와 삽입 사이에 틈이 있어
-- 동시 요청이 모두 통과할 수 있다 → 회원 단위 잠금 안에서 다시 센다.
-- 수치는 lib/inquiry-rules.ts 의 INQUIRY_DAILY_LIMIT / INQUIRY_MIN_INTERVAL_MS 와 같아야 한다.
create or replace function public.inquiries_rate_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count  integer;
  v_latest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('inquiries:' || new.user_id::text, 0));

  select count(*), max(created_at)
    into v_count, v_latest
    from public.inquiries
   where user_id = new.user_id
     and created_at > now() - interval '24 hours';

  if v_latest is not null and v_latest > now() - interval '60 seconds' then
    raise exception 'INQUIRY_RATE_LIMIT_INTERVAL';
  end if;
  if v_count >= 5 then
    raise exception 'INQUIRY_RATE_LIMIT_DAILY';
  end if;
  return new;
end;
$$;

drop trigger if exists inquiries_rate_limit_trg on public.inquiries;
create trigger inquiries_rate_limit_trg before insert on public.inquiries
  for each row execute function public.inquiries_rate_limit();

alter table public.inquiries enable row level security;
revoke all on public.inquiries from anon, authenticated;

comment on table public.inquiries is
  '1:1 문의 (운영자 전용 테이블). 서비스 롤만 접근 — 작성자 본인 열람은 앱 서버가 user_id 로 걸러 제공한다.';

-- 답변 등록 시 작성자에게 보내는 인앱 알림 유형 추가 (기존 목록 + inquiry_answered)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'match_new', 'match_reminder', 'match_completed', 'match_penalized',
    'comment_new', 'post_comment', 'group_upgrade',
    'boost_expiring', 'boost_expired', 'reward_granted', 'weekly_hot',
    'paid_seat_open', 'redemption_done', 'seat_reward', 'seat_issue', 'tester_request',
    'inquiry_answered'
  ));
