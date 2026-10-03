-- 2026-10-03 (21): 유료 시트 주문 상한 30 확정 (사용자 결정 — 000007 의 100 을 되돌림)
-- 000006(30) → 000007(100) → 본 파일(30). 콘솔 슬롯 번호 상한도 동일.

alter table public.paid_tester_orders drop constraint if exists paid_tester_orders_tester_count_check;
alter table public.paid_tester_orders add constraint paid_tester_orders_tester_count_check
  check (tester_count between 1 and 30);
alter table public.paid_order_slots drop constraint if exists paid_order_slots_slot_no_check;
alter table public.paid_order_slots add constraint paid_order_slots_slot_no_check
  check (slot_no between 1 and 30);
