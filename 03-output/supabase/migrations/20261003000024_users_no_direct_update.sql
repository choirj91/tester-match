-- 2026-10-04 (24): 회원 행을 사용자가 API 로 직접 고치지 못하게 한다 (ADR-0013 보강)
--
-- users_update_own 정책은 "자기 행"이면 어떤 열이든 고칠 수 있게 했다. 보호 트리거가
-- role·trust_score·status 는 되돌리지만 email·google_id 는 열려 있어, 로그인한 사용자가
-- 공개 키로 자기 행의 이메일을 남의 주소로 바꾸면 그 주소의 주인은 가입해도 회원 행이
-- 생기지 않았다 (같은 이메일의 연결된 행이 이미 있으므로).
--
-- 앱은 회원 행을 서버(service_role)로만 수정한다 — 사용자 세션으로 수정하는 코드는 없다.
-- 따라서 API 역할의 UPDATE 권한 자체를 거둔다. 조회 정책과 서버 경로는 그대로다.

revoke update on public.users from anon, authenticated;
