-- 2026-10-08 (ADR-0020): 보상 교환 상품 카탈로그 — 신청 행에 상품 코드와 수량을 남긴다.
--
-- 크레딧은 보상 전용이다 (ADR-0014·0017). 회원은 금액을 고르지 않고 교환 상품(네이버페이 포인트 5,000원권,
-- 스타벅스 카페 아메리카노 T 등)과 수량을 고른다. 상품별 크레딧은 앱 코드(lib/rewards.ts)가 단일 원천이고,
-- 서버가 상품 크레딧 × 수량으로 amount 를 계산해 넣는다 — 클라이언트가 보낸 금액은 쓰지 않는다.
--
--   item_code : 카탈로그 상품 코드 (예: starbucks_americano_t). 상품 목록은 앱 배포로 바뀌므로 FK·값 목록 CHECK
--               로 묶지 않는다 (형식만 검사). 2026-10-08 전 신청(5,000 단위 금액 선택)은 null.
--   quantity  : 같은 상품 수량 1~10 (앱 상수 REDEMPTION_MAX_QUANTITY 와 같다). 이전 신청은 null.
--   kind      : 그대로 (gifticon | naver_points) — 새 신청은 상품의 종류를 함께 적는다.
--   amount    : 그대로 — 상품 크레딧 × 수량. 1회 최대 50,000 은 앱 상수 (기타소득 과세최저한).
--
-- 데이터 백필 없음 (이전 행은 kind·amount 로 그대로 읽힌다). 다시 실행해도 안전하다. 데이터를 지우는 문은 없다.

alter table public.credit_redemptions
  add column if not exists item_code text,
  add column if not exists quantity integer;

alter table public.credit_redemptions
  drop constraint if exists credit_redemptions_quantity_check;
alter table public.credit_redemptions
  add constraint credit_redemptions_quantity_check check (quantity between 1 and 10);

alter table public.credit_redemptions
  drop constraint if exists credit_redemptions_item_code_check;
alter table public.credit_redemptions
  add constraint credit_redemptions_item_code_check check (item_code ~ '^[a-z0-9_]{1,64}$');

-- 상품 코드와 수량은 함께 있거나 함께 없다 (새 신청은 둘 다, 이전 신청은 둘 다 null)
alter table public.credit_redemptions
  drop constraint if exists credit_redemptions_item_pair_check;
alter table public.credit_redemptions
  add constraint credit_redemptions_item_pair_check check ((item_code is null) = (quantity is null));

comment on column public.credit_redemptions.item_code is
  '교환 상품 코드 (ADR-0020, 앱 lib/rewards.ts 카탈로그). 2026-10-08 전 신청은 null — kind·amount 로 표시.';
comment on column public.credit_redemptions.quantity is
  '교환 상품 수량 1~10 (ADR-0020). amount = 상품 크레딧 × 수량. 2026-10-08 전 신청은 null.';
comment on column public.credit_redemptions.kind is
  'gifticon | naver_points — 보상 교환 종류 (ADR-0017). 새 신청은 상품의 종류. 운영자가 쿠폰·교환권을 사서 수동 지급.';
