-- =====================================================================
-- Tester Match — 시드 데이터 (개발용)
-- 운영자 1명 + 더미 사용자 5명 + 카테고리 마스터.
-- 프로덕션 배포 시 자동 실행되지 않음 (Supabase CLI: db reset 시에만 적용).
-- =====================================================================

-- 운영자 1명
insert into public.users (email, nickname, role, country)
values ('admin@testermatch.local', '운영자', 'admin', 'KR')
on conflict (email) do nothing;

-- 더미 사용자 5명
insert into public.users (email, nickname, country)
values
  ('dev1@testermatch.local',  '인디개발자A', 'KR'),
  ('dev2@testermatch.local',  '인디개발자B', 'KR'),
  ('test1@testermatch.local', '테스터A',    'KR'),
  ('test2@testermatch.local', '테스터B',    'KR'),
  ('test3@testermatch.local', '테스터C',    'KR')
on conflict (email) do nothing;
