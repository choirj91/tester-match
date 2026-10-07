/**
 * 보상 교환 상점 (ADR-0017) — 크레딧을 바꿀 수 있는 보상 종류.
 * 크레딧은 구매·양도·현금 환급이 안 되고, 여기 있는 보상으로만 바꾼다.
 * 금액 규칙(단위·상한)은 paid-seats.ts 의 REDEMPTION_* 상수가 갖는다 — 이 모듈은 클라이언트에서도 쓰므로
 * 서버 모듈을 import 하지 않는다.
 */

export const REWARD_KINDS = ["gifticon", "naver_points"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export type RewardCatalogItem = {
  kind: RewardKind;
  /** 짧은 이름 — 목록·배지 */
  label: string;
  title: string;
  desc: string;
  howDelivered: string;
  contactPlaceholder: string;
};

export const REWARD_CATALOG: Readonly<Record<RewardKind, RewardCatalogItem>> = {
  gifticon: {
    kind: "gifticon",
    label: "기프티콘",
    title: "카카오톡 기프티콘",
    desc: "카페·편의점 등 원하는 브랜드의 모바일 상품권을 보내 드립니다. 신청할 때 브랜드를 적어 주세요.",
    howDelivered: "휴대폰 번호로 문자·카카오톡 발송",
    contactPlaceholder: "기프티콘 받을 휴대폰 번호 (010-1234-5678)",
  },
  naver_points: {
    kind: "naver_points",
    label: "네이버페이 포인트",
    title: "네이버페이 포인트 쿠폰",
    desc: "네이버페이 포인트 쿠폰(충전 코드)을 보내 드립니다. 네이버페이에서 코드를 등록하면 포인트로 적립됩니다.",
    howDelivered: "휴대폰 번호로 문자 발송",
    contactPlaceholder: "쿠폰 받을 휴대폰 번호 (010-1234-5678)",
  },
};

/** 신청 접수 후 발송까지 (영업일) */
export const REWARD_PROCESSING_BUSINESS_DAYS = 3;

export function isRewardKind(value: unknown): value is RewardKind {
  return typeof value === "string" && (REWARD_KINDS as readonly string[]).includes(value);
}

/** 원장·관리자 화면에 남는 신청 설명 */
export function rewardLedgerDescription(kind: RewardKind): string {
  return `보상 교환 신청 (${REWARD_CATALOG[kind].label})`;
}

/** 공개 페이지·정책·안내 문구에 공통으로 쓰는 크레딧 규칙 (ADR-0017) */
export const CREDIT_RULES = [
  "크레딧은 유료 테스터 시트를 완주한 테스터에게 회사가 지급하는 보상입니다. 테스트 활동으로만 적립됩니다.",
  "크레딧은 구매할 수 없습니다. 카드·계좌이체 등 어떤 결제수단으로도 적립되지 않고, 유료 테스터 결제 금액은 크레딧으로 바뀌지 않습니다.",
  "크레딧은 다른 회원에게 양도·판매·교환할 수 없습니다.",
  "크레딧은 현금으로 환급되지 않습니다. 기프티콘·네이버페이 포인트 교환, 또는 내 앱의 테스터 시트를 여는 데만 쓸 수 있습니다.",
] as const;
