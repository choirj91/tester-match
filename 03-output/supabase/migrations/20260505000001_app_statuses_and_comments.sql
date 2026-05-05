-- =====================================================================
-- Tester Match — 앱 상태 라이프사이클 확장 + app_comments (ADR-0006)
-- 작성일: 2026-05-05
-- =====================================================================

-- ── apps.status 확장 ────────────────────────────────────────────────
alter table public.apps drop constraint apps_status_check;
alter table public.apps
  add constraint apps_status_check check (
    status in ('draft', 'matching', 'reviewing', 'launched', 'completed', 'paused', 'deleted')
  );

comment on column public.apps.status is
  'draft / matching(모집중) / reviewing(심사중) / launched(출시 완료) / completed(레거시=심사중) / paused / deleted';

-- ── app_comments ────────────────────────────────────────────────────
create table public.app_comments (
  id              bigint generated always as identity primary key,
  app_id          bigint not null references public.apps(id) on delete cascade,
  author_user_id  bigint not null references public.users(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 1000),
  promoted_app_id bigint references public.apps(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index app_comments_app_created_idx
  on public.app_comments (app_id, created_at desc)
  where deleted_at is null;

create index app_comments_author_idx on public.app_comments (author_user_id);

create trigger app_comments_set_updated_at before update on public.app_comments
  for each row execute function public.set_updated_at();

alter table public.app_comments enable row level security;

create policy app_comments_select_active
  on public.app_comments for select
  to authenticated
  using (deleted_at is null or public.is_admin());

create policy app_comments_insert_own
  on public.app_comments for insert
  to authenticated
  with check (author_user_id = public.current_app_user_id());

create policy app_comments_update_own
  on public.app_comments for update
  to authenticated
  using (author_user_id = public.current_app_user_id() or public.is_admin())
  with check (author_user_id = public.current_app_user_id() or public.is_admin());
