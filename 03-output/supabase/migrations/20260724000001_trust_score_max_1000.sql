-- 2026-07-24: 신뢰도 정책 v1.1 — 체크인당 +1 적립, 상한 100 → 1000 (ADR-0010 갱신)

alter table public.users
  drop constraint users_trust_score_check;
alter table public.users
  add constraint users_trust_score_check check (trust_score between 0 and 1000);

alter table public.trust_score_history
  drop constraint trust_score_history_score_after_check;
alter table public.trust_score_history
  add constraint trust_score_history_score_after_check check (score_after between 0 and 1000);
