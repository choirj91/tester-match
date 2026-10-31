-- 2026-10-31: 개정 이용약관 시행일 2026-11-28 → 2026-12-01
--
-- 개정 공지가 10-31 에 나가, 불리하거나 중요한 변경의 30일 전 공지(개정 약관 제3조)를 맞추려고
-- 시행일을 12-01 로 옮긴다. 시행 전 버전이라 지금은 행을 지울 수 있다 (policy_versions_guard).
-- 11-28 판에 동의한 기록은 있을 수 없다 — record_policy_consents 가 시행 전 버전을 거절한다.
--
-- 다시 실행해도 안전하게 썼다. 11-28 행 삭제는 아직 시행 전일 때만 한다 — 20261029000001 을 11-28 이후
-- 다시 실행해 그 행이 되살아나면 guard 가 삭제를 막아 이 파일 전체가 실패하므로, 그때는 행을 남겨 둔다
-- (앱 버전 목록에 없는 행이라 동의 판정·기록에 쓰이지 않는다).

delete from public.policy_versions
where kind = 'terms' and version = '2026-11-28' and effective_at > now();

insert into public.policy_versions (kind, version, effective_at, content_sha256) values
  ('terms', '2026-12-01', '2026-12-01 00:00:00+09', 'a6c9f7e52230bd2134d6d554d9b8cc9711f130e0b3ebcdfd5f19f3b80cf81b52')
on conflict (kind, version) do nothing;

notify pgrst, 'reload schema';
