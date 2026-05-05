-- =====================================================================
-- Tester Match — apps 테이블 폼 필드 정렬
-- 작성일: 2026-05-04
-- 변경:
--   1. web_invite_url 컬럼 추가 (Google Play 웹 참여 링크)
--   2. category NOT NULL 완화 + default 'general'
--      (사용자 폼에서 카테고리 입력 미수집, 추후 분류 UX 분리)
--   3. 기존 store_invite_url / required_testers 의미를 사용자 폼 라벨로 코멘트 정리
-- =====================================================================

alter table public.apps
  add column web_invite_url text;

alter table public.apps
  alter column category drop not null,
  alter column category set default 'general';

comment on column public.apps.required_testers is
  '현재 남은 테스터 수. 폼 라벨: "현재 남은 테스터 수". 초기값 12 가 일반적이나 모집 도중 등록 시 더 작은 값.';

comment on column public.apps.store_invite_url is
  '안드로이드 Closed Testing 초대 링크 (play.google.com/apps/test/...). 폼 라벨: "안드로이드 링크".';

comment on column public.apps.web_invite_url is
  'Google Play 웹 참여 링크 (play.google.com/apps/testing/...). 폼 라벨: "웹 참여 링크".';

comment on column public.apps.category is
  '카테고리 (game/utility/social 등). v1 폼 미수집 → default ''general''. F-APP-05 추가 시 마스터 테이블 분리.';
