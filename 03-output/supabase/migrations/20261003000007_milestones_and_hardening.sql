-- 2026-10-03 (7): 마일스톤 보상 + 시트 100 + 정산 하드닝 (ADR-0012 부록 C, 2차 리뷰 반영). 상한 30(000006)을 100으로 대체.

-- ── 1. 시트 상한 10 → 100 ────────────────────────────────────────────
alter table public.paid_tester_orders drop constraint if exists paid_tester_orders_tester_count_check;
alter table public.paid_tester_orders add constraint paid_tester_orders_tester_count_check
  check (tester_count between 1 and 100);
alter table public.paid_order_slots drop constraint if exists paid_order_slots_slot_no_check;
alter table public.paid_order_slots add constraint paid_order_slots_slot_no_check
  check (slot_no between 1 and 100);

-- ── 2. 마일스톤 보상 내역 + 출시 보너스 멱등키 ───────────────────────
alter table public.seat_rewards add column if not exists breakdown jsonb;
create unique index if not exists credits_ledger_paid_seat_launch_uq
  on public.credits_ledger (ref_id) where type = 'earn' and ref_type = 'paid_seat_launch';

-- ── 3. 운영자 폴백 주문 구분 + 스윕 순환 ─────────────────────────────
alter table public.paid_tester_orders
  add column if not exists fulfillment text not null default 'community'
    check (fulfillment in ('community', 'operator')),
  add column if not exists swept_at timestamptz;

-- ── 4. 환불 상한 + 원자적 누적 ───────────────────────────────────────
alter table public.paid_tester_orders drop constraint if exists paid_tester_orders_refund_cap_check;
alter table public.paid_tester_orders add constraint paid_tester_orders_refund_cap_check
  check (refund_due_krw + refunded_krw <= amount_krw);

create or replace function public.order_add_refund_due(p_order bigint, p_amount int)
returns int
language sql
security definer
set search_path = public
as $$
  update paid_tester_orders
     set refund_due_krw = refund_due_krw + p_amount
   where id = p_order
  returning refund_due_krw;
$$;
revoke all on function public.order_add_refund_due(bigint, int) from public, anon, authenticated;

-- ── 5. 교환 연락처 해시 (마스킹 후에도 계정 간 중복 검사 유지) ───────
alter table public.credit_redemptions add column if not exists contact_hash text;
create index if not exists credit_redemptions_contact_hash_idx
  on public.credit_redemptions (contact_hash) where contact_hash is not null;

-- ── 6. ledger_append — 교환 가능액에 출시 보너스 포함 ────────────────
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
    select coalesce(sum(amount), 0) into v_red
      from credits_ledger
     where user_id = p_user
       and ref_type in ('paid_seat', 'paid_seat_launch', 'redemption');
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
    return null;
end
$$;
revoke all on function public.ledger_append(bigint, int, text, text, bigint, text, boolean) from public, anon, authenticated;
