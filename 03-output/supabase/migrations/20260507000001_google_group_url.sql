-- 2026-05-07: Google Play Closed Testing 정책 변경 대응
-- 테스터가 초대 링크를 사용하기 전 Google 그룹에 먼저 가입해야 함
-- apps 테이블에 google_group_url 컬럼 추가 (nullable — 기존 앱 호환)

alter table public.apps
  add column if not exists google_group_url text;

comment on column public.apps.google_group_url is
  'Google 그룹 가입 URL. Closed Testing 참여 전 테스터가 먼저 가입해야 하는 그룹 링크.';
