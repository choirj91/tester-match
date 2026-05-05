-- =====================================================================
-- Tester Match — 초기 스키마 (ERD v0.1 / spec/06_erd.md 기준)
-- 작성일: 2026-05-04
-- 대상: PostgreSQL 15+ (Supabase Free)
-- 주의: RLS는 모든 테이블에 ENABLE 하되 정책은 후속 마이그레이션에서 추가.
--      서버에서는 service_role 키로 우회. 클라이언트 anon 키 접근은 차단됨.
-- =====================================================================

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- updated_at 자동 갱신 트리거 함수
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 2.1 users
-- =====================================================================
create table public.users (
  id                  bigint generated always as identity primary key,
  email               citext      not null unique,
  google_id           text        unique,
  nickname            text        not null,
  timezone            text        not null default 'Asia/Seoul',
  country             char(2),
  trust_score         int         not null default 50 check (trust_score between 0 and 100),
  role                text        not null default 'user' check (role in ('user', 'admin')),
  status              text        not null default 'active'
                        check (status in ('active', 'suspended', 'withdrawn')),
  terms_agreed_at     timestamptz not null default now(),
  privacy_agreed_at   timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index users_status_trust_idx on public.users (status, trust_score desc);
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2.2 devices
-- =====================================================================
create table public.devices (
  id                   bigint generated always as identity primary key,
  user_id              bigint not null references public.users(id) on delete cascade,
  device_fingerprint   text not null unique,
  model                text,
  os_version           text,
  is_primary           boolean not null default true,
  created_at           timestamptz not null default now()
);
create index devices_user_idx on public.devices (user_id);

-- =====================================================================
-- 2.3 apps
-- =====================================================================
create table public.apps (
  id                              bigint generated always as identity primary key,
  owner_user_id                   bigint not null references public.users(id) on delete cascade,
  name                            text not null,
  category                        text not null,
  short_description               text not null check (char_length(short_description) <= 140),
  store_invite_url                text not null,
  store_invite_url_validated_at   timestamptz,
  required_testers                int not null default 12 check (required_testers between 1 and 100),
  status                          text not null default 'draft'
                                    check (status in ('draft', 'matching', 'completed', 'paused', 'deleted')),
  is_boost                        boolean not null default false,
  boost_deadline_at               timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index apps_status_created_idx on public.apps (status, created_at);
create index apps_owner_idx on public.apps (owner_user_id);
create index apps_boost_matching_idx on public.apps (is_boost) where status = 'matching';
create trigger apps_set_updated_at before update on public.apps
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2.4 matches
-- =====================================================================
create table public.matches (
  id                bigint generated always as identity primary key,
  app_id            bigint not null references public.apps(id) on delete cascade,
  tester_user_id    bigint not null references public.users(id) on delete cascade,
  matched_at        timestamptz not null default now(),
  opted_in_at       timestamptz,
  opted_out_at      timestamptz,
  opt_out_reason    text,
  status            text not null default 'pending'
                      check (status in ('pending', 'active', 'completed', 'opted_out', 'penalized')),
  day_count         int not null default 0 check (day_count between 0 and 14),
  credit_payout     int not null default 800 check (credit_payout >= 0),
  created_at        timestamptz not null default now()
);
create index matches_app_status_idx on public.matches (app_id, status);
create index matches_tester_status_idx on public.matches (tester_user_id, status);
create index matches_status_optedin_idx on public.matches (status, opted_in_at);
-- 동일 (app_id, tester_user_id) 활성 매칭은 1개만
create unique index matches_app_tester_active_uniq
  on public.matches (app_id, tester_user_id)
  where status in ('pending', 'active');

-- =====================================================================
-- 2.5 checkins
-- =====================================================================
create table public.checkins (
  id                    bigint generated always as identity primary key,
  match_id              bigint not null references public.matches(id) on delete cascade,
  day_n                 int not null check (day_n between 1 and 14),
  checked_in_at         timestamptz not null default now(),
  screenshot_url        text,
  screenshot_verified   boolean,
  verified_at           timestamptz,
  verified_by           bigint references public.users(id) on delete set null
);
create unique index checkins_match_day_uniq on public.checkins (match_id, day_n);

-- =====================================================================
-- 2.6 credits_ledger (append-only)
-- =====================================================================
create table public.credits_ledger (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references public.users(id) on delete cascade,
  amount          int not null,
  balance_after   int not null,
  type            text not null check (type in (
                    'welcome', 'earn', 'charge', 'spend', 'refund',
                    'penalty', 'adjust', 'expire'
                  )),
  ref_type        text,
  ref_id          bigint,
  description     text,
  created_at      timestamptz not null default now()
);
create index credits_ledger_user_created_idx on public.credits_ledger (user_id, created_at desc);
create index credits_ledger_type_idx on public.credits_ledger (type);
-- append-only 보호: UPDATE/DELETE 차단
create or replace function public.credits_ledger_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'credits_ledger is append-only';
end;
$$;
create trigger credits_ledger_no_update before update on public.credits_ledger
  for each row execute function public.credits_ledger_immutable();
create trigger credits_ledger_no_delete before delete on public.credits_ledger
  for each row execute function public.credits_ledger_immutable();

-- =====================================================================
-- 2.7 payments
-- =====================================================================
create table public.payments (
  id                  bigint generated always as identity primary key,
  user_id             bigint not null references public.users(id) on delete cascade,
  provider            text not null check (provider in ('toss', 'stripe')),
  provider_tx_id      text not null unique,
  amount_krw          int not null check (amount_krw >= 0),
  amount_original     numeric(12, 2),
  currency            char(3) not null default 'KRW',
  purpose             text not null check (purpose in ('charge', 'boost')),
  ref_app_id          bigint references public.apps(id) on delete set null,
  status              text not null default 'pending'
                        check (status in ('pending', 'completed', 'failed', 'refunded', 'partially_refunded')),
  refunded_amount     int not null default 0 check (refunded_amount >= 0),
  paid_at             timestamptz,
  refunded_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index payments_user_created_idx on public.payments (user_id, created_at desc);

-- =====================================================================
-- 2.8 boost_orders
-- =====================================================================
create table public.boost_orders (
  id                bigint generated always as identity primary key,
  app_id            bigint not null references public.apps(id) on delete cascade,
  payment_id        bigint not null references public.payments(id) on delete restrict,
  sla_hours         int not null check (sla_hours in (24, 48)),
  sla_deadline_at   timestamptz not null,
  sla_status        text not null default 'in_progress'
                      check (sla_status in ('in_progress', 'fulfilled', 'partial', 'failed')),
  matched_count     int not null default 0,
  refund_amount     int not null default 0,
  created_at        timestamptz not null default now()
);
create index boost_orders_app_idx on public.boost_orders (app_id);
create index boost_orders_deadline_idx on public.boost_orders (sla_deadline_at)
  where sla_status = 'in_progress';

-- =====================================================================
-- 2.9 reports
-- =====================================================================
create table public.reports (
  id                    bigint generated always as identity primary key,
  reporter_user_id      bigint not null references public.users(id) on delete cascade,
  reported_user_id      bigint not null references public.users(id) on delete cascade,
  match_id              bigint references public.matches(id) on delete set null,
  reason                text not null,
  description           text,
  status                text not null default 'pending'
                          check (status in ('pending', 'reviewing', 'upheld', 'dismissed')),
  reviewed_by           bigint references public.users(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_reported_idx on public.reports (reported_user_id);

-- =====================================================================
-- 2.10 trust_score_history
-- =====================================================================
create table public.trust_score_history (
  id            bigint generated always as identity primary key,
  user_id       bigint not null references public.users(id) on delete cascade,
  delta         int not null,
  score_after   int not null check (score_after between 0 and 100),
  reason        text not null,
  ref_type      text,
  ref_id        bigint,
  created_at    timestamptz not null default now()
);
create index trust_score_history_user_idx on public.trust_score_history (user_id, created_at desc);

-- =====================================================================
-- 2.11 notification_prefs
-- =====================================================================
create table public.notification_prefs (
  user_id              bigint primary key references public.users(id) on delete cascade,
  email_enabled        boolean not null default true,
  discord_webhook_url  text,
  slack_webhook_url    text,
  daily_checkin_hour   int not null default 20 check (daily_checkin_hour between 0 and 23),
  categories           jsonb not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);
create trigger notification_prefs_set_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2.13 audit_logs
-- =====================================================================
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  actor_user_id   bigint references public.users(id) on delete set null,
  action          text not null,
  target_type     text,
  target_id       bigint,
  metadata        jsonb,
  ip              inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- =====================================================================
-- waitlist_signups (Pre-launch 사전 등록)
-- ERD에는 없으나 Week 1 랜딩에서 사용. v1 출시 후 archived.
-- =====================================================================
create table public.waitlist_signups (
  id            bigint generated always as identity primary key,
  email         citext not null unique,
  source        text,
  user_agent    text,
  ip_hash       text,
  created_at    timestamptz not null default now()
);
create index waitlist_signups_created_idx on public.waitlist_signups (created_at desc);

-- =====================================================================
-- RLS — 일단 모든 테이블 ENABLE (정책은 후속 마이그레이션에서 추가).
-- service_role 키는 RLS 우회하므로 서버 코드는 정상 동작.
-- =====================================================================
alter table public.users                enable row level security;
alter table public.devices              enable row level security;
alter table public.apps                 enable row level security;
alter table public.matches              enable row level security;
alter table public.checkins             enable row level security;
alter table public.credits_ledger       enable row level security;
alter table public.payments             enable row level security;
alter table public.boost_orders         enable row level security;
alter table public.reports              enable row level security;
alter table public.trust_score_history  enable row level security;
alter table public.notification_prefs   enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.waitlist_signups     enable row level security;
