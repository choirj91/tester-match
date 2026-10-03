-- 2026-10-03 (6): 유료 시트 주문 상한 10 → 30
--
-- 10명은 운영자 테스터(ADR-0011, 보유 계정 수) 기준이었다. 커뮤니티 마켓(ADR-0012)에서는
-- 이탈 대비 여유분까지 한 번에 살 수 있게 30명으로 올린다. 콘솔 슬롯 번호 상한도 동일하게.
-- 제약 이름이 환경마다 다를 수 있어 컬럼을 참조하는 CHECK 를 찾아서 교체한다.

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
     where n.nspname = 'public' and rel.relname = 'paid_tester_orders'
       and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%tester_count%'
  loop
    execute format('alter table public.paid_tester_orders drop constraint %I', c.conname);
  end loop;

  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
     where n.nspname = 'public' and rel.relname = 'paid_order_slots'
       and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%slot_no%'
  loop
    execute format('alter table public.paid_order_slots drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.paid_tester_orders
  add constraint paid_tester_orders_tester_count_check check (tester_count between 1 and 30);
alter table public.paid_order_slots
  add constraint paid_order_slots_slot_no_check check (slot_no between 1 and 30);
