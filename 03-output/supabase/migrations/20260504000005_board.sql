-- =====================================================================
-- Tester Match — 게시판 v1 (ADR-0005)
-- 작성일: 2026-05-04
-- 추가:
--   - posts (게시글) / comments (댓글)
--   - users_public_profile view (cross-user 닉네임 노출)
--   - RLS 정책
-- =====================================================================

-- ── posts ────────────────────────────────────────────────────────────
create table public.posts (
  id                bigint generated always as identity primary key,
  author_user_id    bigint not null references public.users(id) on delete cascade,
  category          text not null check (category in ('자유', '질문', '공유', '구인')),
  title             text not null check (char_length(title) between 1 and 120),
  body              text not null check (char_length(body) between 1 and 10000),
  view_count        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index posts_category_created_idx
  on public.posts (category, created_at desc)
  where deleted_at is null;

create index posts_author_idx on public.posts (author_user_id);

create trigger posts_set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

-- ── comments ─────────────────────────────────────────────────────────
create table public.comments (
  id                bigint generated always as identity primary key,
  post_id           bigint not null references public.posts(id) on delete cascade,
  author_user_id    bigint not null references public.users(id) on delete cascade,
  body              text not null check (char_length(body) between 1 and 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index comments_post_created_idx
  on public.comments (post_id, created_at)
  where deleted_at is null;

create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

alter table public.comments enable row level security;

-- ── users_public_profile view ────────────────────────────────────────
-- 게시판/매칭에서 author 닉네임 join 용. 이메일/auth 정보는 비노출.
create view public.users_public_profile as
select
  id,
  nickname,
  trust_score,
  role
from public.users
where status = 'active' and deleted_at is null;

grant select on public.users_public_profile to authenticated;

-- ── RLS — posts ──────────────────────────────────────────────────────
create policy posts_select_active
  on public.posts for select
  to authenticated
  using (deleted_at is null or public.is_admin());

create policy posts_insert_own
  on public.posts for insert
  to authenticated
  with check (author_user_id = public.current_app_user_id());

create policy posts_update_own
  on public.posts for update
  to authenticated
  using (author_user_id = public.current_app_user_id() or public.is_admin())
  with check (author_user_id = public.current_app_user_id() or public.is_admin());

-- DELETE 는 사용 안 함 (soft delete via UPDATE deleted_at).

-- ── RLS — comments ───────────────────────────────────────────────────
create policy comments_select_active
  on public.comments for select
  to authenticated
  using (deleted_at is null or public.is_admin());

create policy comments_insert_own
  on public.comments for insert
  to authenticated
  with check (author_user_id = public.current_app_user_id());

create policy comments_update_own
  on public.comments for update
  to authenticated
  using (author_user_id = public.current_app_user_id() or public.is_admin())
  with check (author_user_id = public.current_app_user_id() or public.is_admin());
