-- 2026-09-23: 유료 운영자 테스터 상품 (ADR-0011)
--
-- 1) payments.purpose 에 'paid_testers' 추가 (기존 CHECK 재생성)
-- 2) paid_tester_orders — 주문 원장. 결제 승인(토스 confirm) 성공 시
--    payments 1행 + 본 테이블 status 'pending' → 'paid' 전이.
--    provider_tx_id(=paymentKey) unique 가 결제 기록 멱등 가드.

-- ── 1. payments.purpose 확장 ──────────────────────────────────────────
alter table public.payments drop constraint if exists payments_purpose_check;
alter table public.payments add constraint payments_purpose_check
  check (purpose in ('charge', 'boost', 'paid_testers'));

-- ── 2. paid_tester_orders ────────────────────────────────────────────
create table public.paid_tester_orders (
  id             bigint generated always as identity primary key,
  order_code     text not null unique,        -- 토스 orderId (pt_ 접두)
  app_id         bigint not null references public.apps(id) on delete restrict,
  buyer_user_id  bigint not null references public.users(id) on delete restrict,
  tester_count   int not null check (tester_count between 1 and 10),
  amount_krw     int not null check (amount_krw > 0),  -- tester_count × 1,000 (ADR-0003 단가)
  status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'in_progress',
                                     'completed', 'canceled', 'refunded')),
  payment_id     bigint references public.payments(id) on delete set null,
  payment_key    text,                        -- 토스 paymentKey (환불 시 필요)
  paid_at        timestamptz,
  started_at     timestamptz,                 -- 운영자 테스트 개시
  completed_at   timestamptz,
  admin_note     text,
  created_at     timestamptz not null default now()
);

create index paid_tester_orders_status_created_idx
  on public.paid_tester_orders (status, created_at desc);
create index paid_tester_orders_buyer_idx
  on public.paid_tester_orders (buyer_user_id, created_at desc);
create index paid_tester_orders_app_idx
  on public.paid_tester_orders (app_id);

-- 모든 접근은 service_role(admin client) 경유 — 클라이언트 직접 접근 차단
alter table public.paid_tester_orders enable row level security;

comment on table public.paid_tester_orders is
  'ADR-0011 유료 운영자 테스터 주문. 1명=1,000원, 1~10명. 카드정보 미저장 — orderId/paymentKey/금액/상태만.';
