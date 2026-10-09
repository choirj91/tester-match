/**
 * 보상 교환 상점 (ADR-0017, ADR-0020) — 크레딧을 바꿀 수 있는 교환 상품 카탈로그.
 * 크레딧은 구매·양도·현금 환급이 안 되고, 여기 있는 상품으로만 바꾼다.
 * 상품별 크레딧은 이 파일이 단일 원천이다 — 서버는 상품 코드 × 수량으로 차감액을 계산하고,
 * 클라이언트가 보낸 금액은 쓰지 않는다.
 * 이 모듈은 클라이언트에서도 쓰므로 서버 모듈을 import 하지 않는다.
 */

export const REWARD_KINDS = ["gifticon", "naver_points"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

/** 보상 종류 이름 — 배지, 상품 코드가 없는 이전 신청(2026-10-08 전) 표시 */
export const REWARD_KIND_LABEL: Readonly<Record<RewardKind, string>> = {
  gifticon: "기프티콘",
  naver_points: "네이버페이 포인트",
};

/** 카드 아이콘 — lucide-react 아이콘 이름. 상품 사진·브랜드 로고는 쓰지 않는다 (상표·저작권) */
export type RewardItemIcon = "Coffee" | "Wallet";

export type RewardItem = {
  /** 바뀌지 않는 상품 코드 — credit_redemptions.item_code 에 남는다. 지우지 말고 새 코드를 더한다 */
  code: string;
  kind: RewardKind;
  brand: string;
  /** 브랜드를 뺀 상품 이름 */
  name: string;
  /** 1개당 차감 크레딧 — 상품 정가(원)와 같은 수 (1 크레딧 = 1원 상당) */
  credits: number;
  icon: RewardItemIcon;
  deliveryNote: string;
  /** 사용 허락을 받은 상품 이미지가 생기면 쓴다. 지금은 비워 둔다 (제3자 사진·로고 미사용) */
  imageUrl?: string;
};

/** 1회 신청 상한 — 건당 5만 원 상당 이하, 기타소득 과세최저한 이내로 유지 */
export const REDEMPTION_MAX_CREDITS = 50000;
/** 같은 상품 수량 상한 — DB CHECK(credit_redemptions.quantity between 1 and 10) 와 같다 */
export const REDEMPTION_MAX_QUANTITY = 10;

const COFFEE_DELIVERY = "모바일 교환권을 휴대폰 문자나 카카오톡으로 보내 드립니다.";
const NAVER_POINTS_DELIVERY = "쿠폰 번호를 휴대폰 문자로 보내 드립니다. 네이버페이에서 등록하면 포인트로 적립됩니다.";

/**
 * 교환 상품 — 크레딧 = 정가. 정가는 2026-10-08 에 기사로 확인했다 (가격이 바뀌면 여기만 고친다).
 * - 컴포즈커피 아메리카노(HOT) 1,500원: 2025-02-13 아이스만 1,800원으로 올리고 따뜻한 아메리카노는 1,500원
 *   유지 (스마트투데이 2025-02-03, https://www.smarttoday.co.kr/ko-kr/articles/71431). 2026년 인상 보도 없음.
 * - 메가MGC커피 (HOT)아메리카노 1,700원: 2025-04-21 1,500원 → 1,700원 (SBS Biz 2025-03-31,
 *   https://biz.sbs.co.kr/amp/article/20000225791). 2026-06-19 인상은 할메가커피 3종만
 *   (다음 뉴스 2026-06-04, https://v.daum.net/v/8hIUtjrN3I).
 * - 스타벅스 카페 아메리카노 T 4,700원: 2025-01-24 4,500원 → 4,700원 (경향신문 2025-01-20,
 *   https://www.khan.co.kr/article/202501201549001). 2026년 추가 인상 보도 없음.
 * - 네이버페이 포인트 5,000원권·10,000원권: 쿠폰 권면 금액 그대로.
 * - 이디야커피 아메리카노: 2025-12-16 기본 사이즈 변경(ZDNet 2025-12-16) 뒤 가격을 확인하지 못해 뺐다.
 */
export const REWARD_ITEMS: ReadonlyArray<Readonly<RewardItem>> = [
  {
    code: "compose_americano_hot",
    kind: "gifticon",
    brand: "컴포즈커피",
    name: "아메리카노 (HOT)",
    credits: 1500,
    icon: "Coffee",
    deliveryNote: COFFEE_DELIVERY,
  },
  {
    code: "mega_americano_hot",
    kind: "gifticon",
    brand: "메가MGC커피",
    name: "(HOT)아메리카노",
    credits: 1700,
    icon: "Coffee",
    deliveryNote: COFFEE_DELIVERY,
  },
  {
    code: "starbucks_americano_t",
    kind: "gifticon",
    brand: "스타벅스",
    name: "카페 아메리카노 T",
    credits: 4700,
    icon: "Coffee",
    deliveryNote: COFFEE_DELIVERY,
  },
  {
    code: "npay_5000",
    kind: "naver_points",
    brand: "네이버페이",
    name: "포인트 5,000원권",
    credits: 5000,
    icon: "Wallet",
    deliveryNote: NAVER_POINTS_DELIVERY,
  },
  {
    code: "npay_10000",
    kind: "naver_points",
    brand: "네이버페이",
    name: "포인트 10,000원권",
    credits: 10000,
    icon: "Wallet",
    deliveryNote: NAVER_POINTS_DELIVERY,
  },
];

/** 가장 싼 상품 — "N 크레딧부터 교환" 안내 문구 */
export const REWARD_MIN_ITEM_CREDITS = Math.min(...REWARD_ITEMS.map((item) => item.credits));

/** 신청 접수 후 발송까지 (영업일) */
export const REWARD_PROCESSING_BUSINESS_DAYS = 3;

export function isRewardKind(value: unknown): value is RewardKind {
  return typeof value === "string" && (REWARD_KINDS as readonly string[]).includes(value);
}

export function findRewardItem(code: unknown): Readonly<RewardItem> | null {
  if (typeof code !== "string") return null;
  return REWARD_ITEMS.find((item) => item.code === code) ?? null;
}

/** 브랜드 + 상품 이름 — 예: "스타벅스 카페 아메리카노 T" */
export function rewardItemTitle(item: Pick<RewardItem, "brand" | "name">): string {
  return `${item.brand} ${item.name}`;
}

/** 한 번에 신청할 수 있는 수량 — 수량 상한과 1회 크레딧 상한 중 작은 쪽 */
export function rewardMaxQuantity(item: Pick<RewardItem, "credits">): number {
  return Math.max(0, Math.min(REDEMPTION_MAX_QUANTITY, Math.floor(REDEMPTION_MAX_CREDITS / item.credits)));
}

export type RedemptionQuote =
  | { ok: true; item: Readonly<RewardItem>; quantity: number; total: number }
  | { ok: false; message: string };

/** 상품 코드 × 수량 → 차감 크레딧. 신청 API 와 신청 폼이 같은 규칙을 쓴다 */
export function quoteRedemption(code: unknown, quantity: number): RedemptionQuote {
  const item = findRewardItem(code);
  if (!item) {
    return { ok: false, message: "교환할 수 없는 상품입니다. 목록에서 다시 골라주세요." };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, message: "수량을 1개 이상 골라주세요." };
  }
  if (quantity > REDEMPTION_MAX_QUANTITY) {
    return { ok: false, message: `같은 상품은 한 번에 ${REDEMPTION_MAX_QUANTITY}개까지 신청할 수 있습니다.` };
  }
  const total = item.credits * quantity;
  if (total > REDEMPTION_MAX_CREDITS) {
    return {
      ok: false,
      message: `한 번에 ${REDEMPTION_MAX_CREDITS.toLocaleString("ko-KR")} 크레딧까지 교환할 수 있습니다.`,
    };
  }
  return { ok: true, item, quantity, total };
}

/** 상품 × 수량 — 예: "스타벅스 카페 아메리카노 T ×2" */
export function rewardItemSummary(item: Pick<RewardItem, "brand" | "name">, quantity: number): string {
  return `${rewardItemTitle(item)} ×${quantity}`;
}

/** 원장·관리자 화면에 남는 신청 설명 */
export function rewardLedgerDescription(item: Pick<RewardItem, "brand" | "name">, quantity: number): string {
  return `보상 교환 신청 (${rewardItemSummary(item, quantity)})`;
}

export type RedemptionRowLite = {
  kind: string;
  item_code: string | null;
  quantity: number | null;
};

/**
 * 신청 행 표시 이름 — 상품 코드가 있으면 "상품 ×수량", 2026-10-08 전 신청(금액 직접 선택)은 보상 종류 이름.
 * 카탈로그에서 빠진 코드는 코드를 그대로 보여 준다.
 */
export function redemptionLabel(row: RedemptionRowLite): string {
  const quantity = row.quantity ?? 1;
  const item = findRewardItem(row.item_code);
  if (item) return rewardItemSummary(item, quantity);
  const kindLabel = isRewardKind(row.kind) ? REWARD_KIND_LABEL[row.kind] : row.kind;
  return row.item_code ? `${kindLabel} (${row.item_code} ×${quantity})` : kindLabel;
}

/** 공개 페이지·정책·안내 문구에 공통으로 쓰는 크레딧 규칙 (ADR-0017) */
export const CREDIT_RULES = [
  "크레딧은 유료 테스터 시트를 완주한 테스터에게 회사가 지급하는 보상입니다. 테스트 활동으로만 적립됩니다.",
  "크레딧은 구매할 수 없습니다. 카드·계좌이체 등 어떤 결제수단으로도 적립되지 않고, 유료 테스터 결제 금액은 크레딧으로 바뀌지 않습니다.",
  "크레딧은 다른 회원에게 양도·판매·교환할 수 없습니다.",
  "크레딧은 현금으로 환급되지 않습니다. 기프티콘·네이버페이 포인트 교환, 또는 내 앱의 테스터 시트를 여는 데만 쓸 수 있습니다.",
] as const;
