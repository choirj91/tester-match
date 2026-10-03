-- 2026-10-03 (22): 이메일 가입 남용 방지 — 시도 기록 (ADR-0013)
-- 가입 요청은 임의 주소로 인증 메일을 보내므로 IP 당·전체 시간당 횟수를 제한한다.
-- IP 는 원문이 아닌 해시만 저장한다.

create table public.signup_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index signup_attempts_ip_created_idx on public.signup_attempts (ip_hash, created_at desc);
create index signup_attempts_created_idx on public.signup_attempts (created_at desc);
alter table public.signup_attempts enable row level security;
comment on table public.signup_attempts is
  '이메일 가입 요청 기록 (IP 해시). 시간당 제한 판정용 — service_role 전용.';
