-- 2026-10-06 (ADR-0018): 앱 행을 사용자가 API 로 직접 쓰지 못하게 한다.
--
-- apps_insert_own·apps_update_own·apps_delete_own 정책은 "자기 앱"이면 어떤 열이든 쓸 수 있게 했다.
-- 급구(is_boost·boost_deadline_at)는 이제 유료 테스터 결제가 확정될 때만 켜진다. 공개 키와 자기
-- 세션으로 apps 행을 직접 고치거나 is_boost=true 로 넣으면 결제 없이 급구가 켜진다.
--
-- 앱은 apps 행을 서버(service_role)로만 쓴다 — 사용자 세션으로 쓰는 코드는 없다
-- (20261003000024 의 users 와 같은 처리). 조회 정책과 서버 경로는 그대로다.

revoke insert, update, delete on public.apps from anon, authenticated;
