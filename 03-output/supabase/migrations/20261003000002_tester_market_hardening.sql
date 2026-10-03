-- 2026-10-03 (2): 테스터 마켓 하드닝 — 리뷰 반영 (ADR-0012)
--
-- 1) ledger_append RPC — 유저별 advisory lock 안에서 잔액/교환가능액 검증 + INSERT (이중지출 차단)
-- 2) credits_ledger 부분 unique — 완주 보상·시트 구매·환급 멱등
-- 3) credit_redemptions — 유저당 대기 신청 1건
-- 4) paid_tester_orders.seats_closed — 운영자 폴백 개시 시 커뮤니티 시트 닫기

-- ── 1. ledger_append ─────────────────────────────────────────────────
create or replace function public.ledger_append(
  p_user bigint,
  p_amount int,
  p_type text,
  p_ref_type text default null,
  p_ref_id bigint default null,
  p_desc text default null,
  p_cap_redeemable boolean default false
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal int;
  v_red int;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(p_user);

  select coalesce(sum(amount), 0) into v_bal from credits_ledger where user_id = p_user;
  if p_amount < 0 and v_bal + p_amount < 0 then
    raise exception 'INSUFFICIENT';
  end if;

  if p_cap_redeemable then
    -- 교환 가능액 = 유료 시트 적립(몰수 포함 전 타입) + 교환 차감/환급, 잔액 상한
    select coalesce(sum(amount), 0) into v_red
      from credits_ledger
     where user_id = p_user
       and (ref_type = 'paid_seat' or ref_type = 'redemption');
    if least(v_red, v_bal) + p_amount < 0 then
      raise exception 'NOT_REDEEMABLE';
    end if;
  end if;

  insert into credits_ledger (user_id, amount, balance_after, type, ref_type, ref_id, description)
  values (p_user, p_amount, v_bal + p_amount, p_type, p_ref_type, p_ref_id, p_desc)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    return null;   -- 멱등: 같은 ref 로 이미 기록됨
end
$$;

revoke all on function public.ledger_append(bigint, int, text, text, bigint, text, boolean) from public, anon, authenticated;

-- ── 2. 멱등 인덱스 ───────────────────────────────────────────────────
create unique index if not exists credits_ledger_paid_seat_earn_uq
  on public.credits_ledger (ref_id) where type = 'earn' and ref_type = 'paid_seat';
create unique index if not exists credits_ledger_paid_order_spend_uq
  on public.credits_ledger (ref_id) where type = 'spend' and ref_type = 'paid_order';
create unique index if not exists credits_ledger_paid_order_refund_uq
  on public.credits_ledger (ref_id) where type = 'refund' and ref_type = 'paid_order';
create unique index if not exists credits_ledger_redemption_refund_uq
  on public.credits_ledger (ref_id) where type = 'refund' and ref_type = 'redemption' and ref_id is not null;

-- ── 3. 대기 신청 1건 ─────────────────────────────────────────────────
create unique index if not exists credit_redemptions_one_requested_uq
  on public.credit_redemptions (user_id) where status = 'requested';

-- ── 4. seats_closed ──────────────────────────────────────────────────
alter table public.paid_tester_orders
  add column if not exists seats_closed boolean not null default false;
comment on column public.paid_tester_orders.seats_closed is
  '운영자 테스터 투입(폴백) 개시 시 true — 커뮤니티 시트 배정 중단';
