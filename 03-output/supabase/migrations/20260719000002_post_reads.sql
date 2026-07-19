-- 2026-07-19: 게시물 읽음 기록 (user_id × post_id 조인 테이블)
-- 현재는 공지(카테고리='공지') 읽음 추적에만 사용.
-- 범용 구조라 추후 일반 게시물 읽음 표시로 확장 가능.

create table public.post_reads (
  user_id   bigint not null references public.users(id) on delete cascade,
  post_id   bigint not null references public.posts(id) on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- 게시물 기준 조회 (읽은 사람 수 등 확장 대비)
create index post_reads_post_idx on public.post_reads (post_id);

alter table public.post_reads enable row level security;

-- 본인 기록만 조회 (쓰기는 서버 admin client 전용)
create policy "본인 읽음 기록 조회"
  on public.post_reads for select
  using (user_id = public.current_app_user_id());
