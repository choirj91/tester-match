-- ADR-0017: 보상 교환 종류에 네이버페이 포인트(쿠폰) 추가.
-- 크레딧은 보상 전용 — 기프티콘·네이버페이 포인트로만 바꾼다. 금액 규칙(5,000 단위·1회 50,000)은 앱 상수.
alter table public.credit_redemptions
  drop constraint if exists credit_redemptions_kind_check;
alter table public.credit_redemptions
  add constraint credit_redemptions_kind_check check (kind in ('gifticon', 'naver_points'));
comment on column public.credit_redemptions.kind is
  'gifticon | naver_points — 보상 교환 종류 (ADR-0017). 네이버페이 포인트는 운영자가 쿠폰을 사서 수동 지급.';
