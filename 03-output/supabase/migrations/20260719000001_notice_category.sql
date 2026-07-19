-- 2026-07-19: 공지사항 카테고리 추가 (관리자 전용 — 권한 검증은 API 레이어)

alter table public.posts
  drop constraint posts_category_check;

alter table public.posts
  add constraint posts_category_check check (category in (
    '공지', '자유', '질문', '공유', '구인'
  ));
