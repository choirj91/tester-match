-- 2026-09-29: 유료 테스터 콘솔 (ADR-0011 이행 증빙)
--
-- 1) paid_order_slots — 주문별 테스터 슬롯 (tester_count 만큼, 운영 계정 라벨)
-- 2) paid_order_logs  — 슬롯 × 일차(1~14) 출석·코멘트·스크린샷 경로
-- 3) storage bucket   — paid-order-screenshots (private, service_role 경유만)

create table public.paid_order_slots (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.paid_tester_orders(id) on delete cascade,
  slot_no     int    not null check (slot_no between 1 and 10),
  label       text   not null default '',   -- 예: tester03
  created_at  timestamptz not null default now(),
  unique (order_id, slot_no)
);

create table public.paid_order_logs (
  id               bigint generated always as identity primary key,
  order_id         bigint not null references public.paid_tester_orders(id) on delete cascade,
  slot_id          bigint not null references public.paid_order_slots(id) on delete cascade,
  day_n            int    not null check (day_n between 1 and 14),
  status           text   not null default 'done' check (status in ('done', 'missed')),
  comment          text   not null default '',
  screenshot_path  text,                    -- storage object path (bucket 내 상대 경로)
  logged_by        bigint references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (slot_id, day_n)
);
create index paid_order_logs_order_day_idx on public.paid_order_logs (order_id, day_n);

alter table public.paid_order_slots enable row level security;
alter table public.paid_order_logs  enable row level security;

-- 스크린샷 버킷: 비공개. 조회는 서버가 서명 URL(1시간) 발급.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'paid-order-screenshots', 'paid-order-screenshots', false,
  5242880, array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

comment on table public.paid_order_slots is 'ADR-0011 유료 주문 테스터 슬롯. 개시 시 tester_count 만큼 생성.';
comment on table public.paid_order_logs  is 'ADR-0011 슬롯×일차 이행 로그. 구매자 콘솔에 출석·스샷·코멘트로 노출.';
