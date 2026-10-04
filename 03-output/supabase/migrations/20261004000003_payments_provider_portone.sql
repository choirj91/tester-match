-- 2026-10-04 (3): 결제대행 전환 — 토스페이먼츠 → 포트원 V2 (PG: NHN KCP).
-- payments.provider 에 'portone' 을 추가한다. 기존 값('toss', 'stripe', 'credits')은 그대로 둔다 (과거 행 보존).
-- 적용 순서: 포트원 결제 코드가 배포되기 전에 적용한다 — 먼저 배포하면 결제 기록(payments insert)이
-- CHECK 위반으로 실패해 결제된 주문이 확정되지 않는다 (주문은 pending 으로 남아 적용 후 스윕이 복구).

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('toss', 'stripe', 'credits', 'portone'));
