-- =====================================================================
-- store_invite_url NOT NULL 해제
-- 작성일: 2026-05-05
-- 목적:
--   관리자 일괄 등록 시 Play Store URL 없이도 앱 등록 가능하도록
--   store_invite_url 컬럼의 NOT NULL 제약 해제.
--   나중에 앱 소유자가 직접 URL 을 입력할 수 있음.
-- =====================================================================

alter table public.apps
  alter column store_invite_url drop not null;

comment on column public.apps.store_invite_url is
  'Google Play Closed Testing 초대 링크. 관리자 일괄 등록 시 없을 수 있음.';
