-- =====================================================================
-- Tester Match — required_testers 0 허용
-- 작성일: 2026-05-05
-- 목적:
--   관리자 import 및 앱 등록/수정에서 required_testers=0 을 허용.
--   0 은 "현재 남은 모집 정원 0명"으로 저장되며, 매칭 API 는 기존처럼
--   required_testers <= 0 일 때 정원 마감으로 처리한다.
-- =====================================================================

alter table public.apps
  drop constraint if exists apps_required_testers_check;

alter table public.apps
  add constraint apps_required_testers_check
  check (required_testers between 0 and 100);

comment on column public.apps.required_testers is
  '현재 남은 테스터 수. 0~100 범위. 0 은 현재 남은 모집 정원 없음, 기본값 12.';

