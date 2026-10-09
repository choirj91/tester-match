-- 2026-10-08 (ADR-0020): 보상 교환 신청·거절을 DB 함수 한 번의 호출(한 트랜잭션)로 처리한다.
--
-- 지금까지 서버가 여러 요청으로 나눠 했다: 연락처 중복 조회 → 교환 가능액 조회 → 원장 차감(ledger_append)
-- → 신청 insert (실패하면 복구 행 추가), 거절은 상태 update → 복구 행 추가 (실패하면 상태 되돌림).
-- 중간에 끊기면 차감만 남거나 복구가 빠질 수 있고, 같은 번호로 두 계정이 동시에 신청하면 둘 다 통과할 수 있었다.
--
--   redemption_create(...)  회원 잠금 + 연락처 잠금 안에서 검사 → 신청 insert → 차감 → 신청에 원장 id 기록.
--                           돌려주는 값 (text):
--                             'ok:<신청 id>'
--                             'invalid'         인자가 규칙 밖 (금액 1~50,000·수량 1~10·종류·코드·연락처 형식)
--                             'pending'         처리 대기 신청이 이미 있다 (회원당 1건)
--                             'not_redeemable'  교환 가능액(유료 시트 적립분, 잔액 상한) 부족
--                             'contact_in_use'  다른 회원의 대기·발송 완료 신청에 쓰인 번호 (거절된 신청은 세지 않는다 —
--                                               남의 번호로 신청했다가 거절돼도 번호 주인이 막히지 않게)
--                           검사 순서는 대기 → 교환 가능액 → 번호. 금액은 앱이 카탈로그(lib/rewards.ts)에서 계산해 넘긴다.
--   redemption_reject(...)  'requested' 인 신청만 거절로 바꾸고(연락처 마스킹) 같은 트랜잭션에서 복구 행을 남긴다.
--                           돌려주는 값: 'rejected' | 'already' (없거나 이미 처리됨).
--                           복구 행은 credits_ledger_redemption_refund_uq (ref_id = 신청 id) 로 한 번만 생긴다.
--
-- 잠금: 회원 잠금은 ledger_append 와 같은 키(pg_advisory_xact_lock(회원 id))라 크레딧이 움직이는 다른 경로와도
-- 직렬화된다. 연락처 잠금은 두 정수 키 공간(한 정수 키와 겹치지 않는다)에 둔다. 항상 회원 → 연락처 순으로 잡는다.
-- 차감·복구 자체는 기존 ledger_append 를 그대로 부른다 (잔액·교환 가능액 재검사, balance_after 계산).
--
-- 1회 상한 50,000 크레딧을 테이블에도 둔다 (기타소득 과세최저한). 기존 행에 넘는 값이 있으면 새 행에만 적용하고
-- 알림을 남긴다 — 마이그레이션이 실패하지 않게.
--
-- service_role 전용. 다시 실행해도 안전하다. 데이터를 지우는 문은 없다.

-- ── 1. 1회 상한 ──────────────────────────────────────────────────────
alter table public.credit_redemptions
  drop constraint if exists credit_redemptions_amount_max_check;
alter table public.credit_redemptions
  add constraint credit_redemptions_amount_max_check check (amount <= 50000) not valid;
do $$
begin
  if exists (select 1 from public.credit_redemptions where amount > 50000) then
    raise notice 'credit_redemptions: amount > 50000 rows exist — check applies to new rows only (not validated)';
  else
    alter table public.credit_redemptions validate constraint credit_redemptions_amount_max_check;
  end if;
end
$$;

-- ── 2. 신청 ──────────────────────────────────────────────────────────
create or replace function public.redemption_create(
  p_user bigint,
  p_item_code text,
  p_quantity integer,
  p_amount integer,
  p_kind text,
  p_contact text,
  p_contact_hash text,
  p_note text,
  p_description text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- lib/rewards.ts REDEMPTION_MAX_CREDITS·REDEMPTION_MAX_QUANTITY 와 같은 값
  c_max_credits constant integer := 50000;
  c_max_quantity constant integer := 10;
  v_balance integer;
  v_redeemable integer;
  v_id bigint;
  v_ledger bigint;
begin
  if p_user is null
     or p_amount is null or p_amount < 1 or p_amount > c_max_credits
     or p_quantity is null or p_quantity < 1 or p_quantity > c_max_quantity
     or p_kind is null or p_kind not in ('gifticon', 'naver_points')
     or p_item_code is null or p_item_code !~ '^[a-z0-9_]{1,64}$'
     or p_contact is null or p_contact !~ '^01[016789][0-9]{7,8}$'
     or p_contact_hash is null or p_contact_hash !~ '^[0-9a-f]{64}$'
     or coalesce(length(p_note), 0) > 200 then
    return 'invalid';
  end if;

  perform pg_advisory_xact_lock(p_user);
  perform pg_advisory_xact_lock(hashtext('credit_redemptions.contact_hash'), hashtext(p_contact_hash));

  if exists (
    select 1 from public.credit_redemptions where user_id = p_user and status = 'requested'
  ) then
    return 'pending';
  end if;

  -- ledger_append 의 교환 가능액 식과 같다: 유료 시트 적립 + 교환 차감·복구 합, 전체 잔액을 넘지 않음
  select coalesce(sum(amount), 0) into v_balance from public.credits_ledger where user_id = p_user;
  select coalesce(sum(amount), 0) into v_redeemable
    from public.credits_ledger
   where user_id = p_user
     and ref_type in ('paid_seat', 'paid_seat_launch', 'redemption');
  if least(v_redeemable, v_balance) < p_amount then
    return 'not_redeemable';
  end if;

  if exists (
    select 1 from public.credit_redemptions
     where contact_hash = p_contact_hash
       and user_id <> p_user
       and status in ('requested', 'done')
  ) then
    return 'contact_in_use';
  end if;

  insert into public.credit_redemptions
    (user_id, kind, item_code, quantity, amount, contact, contact_hash, note)
  values
    (p_user, p_kind, p_item_code, p_quantity, p_amount, p_contact, p_contact_hash, coalesce(p_note, ''))
  returning id into v_id;

  -- 잔액·교환 가능액을 잠금 안에서 다시 확인하며 차감 (모자라면 예외 → 신청 insert 까지 함께 롤백)
  v_ledger := public.ledger_append(p_user, -p_amount, 'spend', 'redemption', v_id, p_description, true);
  if v_ledger is null then
    raise exception 'redemption_create: spend ledger row was not written for redemption %', v_id;
  end if;

  update public.credit_redemptions set ledger_id = v_ledger where id = v_id;
  return 'ok:' || v_id;
end;
$$;

revoke all on function public.redemption_create(bigint, text, integer, integer, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.redemption_create(bigint, text, integer, integer, text, text, text, text, text)
  to service_role;

-- ── 3. 거절 ──────────────────────────────────────────────────────────
create or replace function public.redemption_reject(p_id bigint, p_admin bigint, p_note text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_user bigint;
  v_amount integer;
begin
  -- 상태 조건부 update — 동시에 두 번 눌러도 한쪽만 행을 얻는다 (다른 쪽은 행 잠금을 기다린 뒤 'already')
  update public.credit_redemptions
     set status = 'rejected',
         admin_note = v_note,
         processed_by = p_admin,
         processed_at = now(),
         -- 발송 완료와 같은 마스킹: 뒤 4자리만 남긴다 (중복 검사는 contact_hash 로 한다)
         contact = case
           when length(contact) > 4 then repeat('*', length(contact) - 4) || right(contact, 4)
           else contact
         end
   where id = p_id and status = 'requested'
  returning user_id, amount into v_user, v_amount;
  if not found then
    return 'already';
  end if;

  -- null = 이 신청의 복구 행이 이미 있다 (credits_ledger_redemption_refund_uq) — 두 번 복구하지 않는다
  perform public.ledger_append(
    v_user, v_amount, 'refund', 'redemption', p_id,
    '보상 교환 거절 복구 (신청 #' || p_id || ')' || coalesce(' — ' || v_note, ''),
    false
  );
  return 'rejected';
end;
$$;

revoke all on function public.redemption_reject(bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.redemption_reject(bigint, bigint, text) to service_role;

comment on function public.redemption_create(bigint, text, integer, integer, text, text, text, text, text) is
  '보상 교환 신청 — 잠금·검사·신청·차감을 한 트랜잭션으로 (ADR-0020). ok:<id> | invalid | pending | not_redeemable | contact_in_use';
comment on function public.redemption_reject(bigint, bigint, text) is
  '보상 교환 거절 — 상태 조건부 update + 연락처 마스킹 + 복구 행을 한 트랜잭션으로 (ADR-0020). rejected | already';

-- PostgREST 가 새 함수를 보도록 스키마 캐시를 다시 읽게 한다 (듣는 쪽이 없으면 아무 일도 없다)
notify pgrst, 'reload schema';
