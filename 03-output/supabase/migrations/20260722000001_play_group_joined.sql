-- 2026-07-22: Play Console 공개 그룹(tester-match@googlegroups.com) 가입 자가확인
-- consumer 그룹은 API 로 멤버십 확인 불가 → 사용자가 가입 후 버튼으로 자가 신고.

alter table public.users
  add column play_group_joined_at timestamptz;

comment on column public.users.play_group_joined_at is
  'tester-match@googlegroups.com (Play 테스터 자격 그룹) 가입 자가확인 시각. NULL = 미확인.';
