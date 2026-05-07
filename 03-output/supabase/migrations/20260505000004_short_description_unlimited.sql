-- =====================================================================
-- Tester Match — short_description 길이 제한 제거
-- 작성일: 2026-05-05
-- 목적:
--   외부 수집 데이터 import 시 앱 설명이 140자를 넘는 경우를 허용.
--   NOT NULL 은 유지하고, 관리자 import 에서는 null/빈 문자열을 기본 문구로 정규화한다.
-- =====================================================================

alter table public.apps
  drop constraint if exists apps_short_description_check;

comment on column public.apps.short_description is
  '앱 설명. 길이 제한 없음. 관리자 import 에서는 비어 있으면 기본 문구로 정규화.';

