-- 2026-08-15: "이야기" 카테고리 DB 제약 반영
-- (코드 zod 에는 어제 추가했으나 posts_category_check 갱신이 누락돼
--  이야기 카테고리 글 작성이 23514 로 거부되고 있었다)

alter table public.posts
  drop constraint posts_category_check;
alter table public.posts
  add constraint posts_category_check check (
    category in ('공지', '이야기', '자유', '질문', '공유', '구인')
  );
