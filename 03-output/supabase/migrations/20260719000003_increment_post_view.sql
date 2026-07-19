-- 2026-07-19: 게시물 조회수 원자적 증가 함수
-- read-modify-write 대신 DB 단일 UPDATE — 동시 열람 시 유실 없음.

create or replace function public.increment_post_view(p_post_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts
  set view_count = view_count + 1
  where id = p_post_id
    and deleted_at is null;
$$;
