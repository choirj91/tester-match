-- 2026-07-25: 방문자 집계 날짜를 UTC → KST 로 교정
--
-- visit_date 가 default current_date(UTC) 라서 KST 00:00~09:00 방문이
-- 전날로 기록됨 — 그래프의 "오늘" 막대가 오전 9시까지 항상 0 이 되는 원인.
-- 기본값을 KST 날짜로 바꾸고, 기존 행도 created_at 기준으로 소급 보정한다.

alter table public.page_views
  alter column visit_date set default ((now() at time zone 'Asia/Seoul')::date);

-- 보정 중 일시적 unique 충돌을 피하기 위해 인덱스를 내렸다 다시 만든다
drop index public.page_views_session_date_uidx;

-- 같은 세션이 UTC 날짜 경계로 이틀에 걸쳐 기록됐지만 KST 로는 같은 날인 중복 제거
delete from public.page_views p
using public.page_views q
where p.session_id = q.session_id
  and (p.created_at at time zone 'Asia/Seoul')::date
      = (q.created_at at time zone 'Asia/Seoul')::date
  and p.id > q.id;

-- 전 행을 KST 날짜로 재계산
update public.page_views
set visit_date = (created_at at time zone 'Asia/Seoul')::date
where visit_date <> (created_at at time zone 'Asia/Seoul')::date;

create unique index page_views_session_date_uidx
  on public.page_views (session_id, visit_date);
