-- 2026-05-16: 방문자 추적 테이블
-- 기기별 세션 ID + 날짜로 일별 고유 방문자 수 집계.

create table public.page_views (
  id          bigint generated always as identity primary key,
  session_id  text not null check (char_length(session_id) <= 64),
  visit_date  date not null default current_date,
  created_at  timestamptz not null default now()
);

-- 같은 기기가 같은 날 중복 집계 방지
create unique index page_views_session_date_uidx
  on public.page_views (session_id, visit_date);

-- 날짜별 집계 빠른 조회
create index page_views_date_idx
  on public.page_views (visit_date desc);

-- admin client(service_role)만 읽기/쓰기 — RLS 비활성화
