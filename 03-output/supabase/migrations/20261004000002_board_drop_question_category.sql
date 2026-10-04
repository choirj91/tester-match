-- 2026-10-04 (2): 게시판 "질문" 분류 제거 — 운영팀에 묻는 글은 1:1 문의(inquiries)로 받는다.
-- 기존 질문 글(2026-10-04 기준 id 7, 8, 9)은 지우지 않고 "자유"로 옮긴다. 글의 수정 시각은 바꾸지 않는다.
-- 적용 순서: "질문"을 고를 수 없는 코드가 배포된 뒤에 적용한다 (먼저 적용하면 이전 화면의 글쓰기가 실패한다).

alter table public.posts disable trigger posts_set_updated_at;
update public.posts set category = '자유' where category = '질문';
alter table public.posts enable trigger posts_set_updated_at;

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check check (
  category in ('공지', '이야기', '자유', '공유', '구인')
);
