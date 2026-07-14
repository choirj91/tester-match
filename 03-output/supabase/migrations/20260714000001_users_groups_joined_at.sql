-- 2026-07-14: 사용자별 Tester Match Google 그룹 자동 가입 여부 추적
-- getCurrentUser() 에서 이 컬럼이 NULL 인 유저만 Directory API 호출.

alter table public.users
  add column groups_joined_at timestamptz;

comment on column public.users.groups_joined_at is
  'Google Workspace 테스터 그룹에 이 사용자를 addMember 로 추가한 시각. NULL 이면 다음 로그인 시 재시도.';
