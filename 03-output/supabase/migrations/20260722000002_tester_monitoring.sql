-- 2026-07-22: 개발자용 테스터 모니터링
-- Google 은 개별 테스터의 설치·실행 여부를 제공하지 않음 (공개/비공개 무관).
-- 플랫폼 자체 신호로 대체: 설치 자가확인 + 플랫폼 출석(last_seen) + 체크인.

-- 테스터가 "앱 설치 완료"를 자가확인한 시각
alter table public.matches
  add column installed_at timestamptz;

comment on column public.matches.installed_at is
  '테스터 설치 자가확인 시각. NULL = 미확인. Google API 로 실설치 검증 불가하므로 자가신고.';

-- 플랫폼 마지막 접속 (1시간 throttle 로 갱신)
alter table public.users
  add column last_seen_at timestamptz;

comment on column public.users.last_seen_at is
  '플랫폼 마지막 활동 시각. getCurrentUser 에서 1시간 간격 갱신. 개발자 모니터링의 출석 신호.';
