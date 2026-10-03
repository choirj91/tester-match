/**
 * 유료 운영자 테스터 상품 (ADR-0011) — 상수·헬퍼.
 * 단가는 ADR-0003 잠금 결정(1매칭 = 1,000원)을 따른다.
 */

export const PAID_TESTER_PRICE_KRW = 1000;
export const PAID_TESTER_MIN_COUNT = 1;
export const PAID_TESTER_MAX_COUNT = 10;

export type PaidOrderStatus =
  | "pending"
  | "paid"
  | "in_progress"
  | "completed"
  | "canceled"
  | "refunded";

export const PAID_ORDER_STATUS_LABEL: Record<PaidOrderStatus, string> = {
  pending: "결제 대기",
  paid: "결제 완료",
  in_progress: "테스트 진행 중",
  completed: "완료",
  canceled: "취소",
  refunded: "환불",
};

export function paidTesterAmountKrw(testerCount: number): number {
  return testerCount * PAID_TESTER_PRICE_KRW;
}

/** 토스 orderName 은 최대 100자 — 초과 시 앱 이름을 축약한다. */
export function paidTesterOrderName(appName: string, testerCount: number): string {
  const suffix = ` 테스터 ${testerCount}명 (14일)`;
  const maxAppNameLength = 100 - suffix.length;
  const name =
    appName.length > maxAppNameLength ? `${appName.slice(0, maxAppNameLength - 1)}…` : appName;
  return `${name}${suffix}`;
}

/**
 * 주문 오픈 게이트. 토스 라이브 키 전환 전까지 운영자만 주문 가능 —
 * 샌드박스 키 상태에서 일반 유저가 "가상 결제" 로 주문을 만드는 것을 막는다.
 * 라이브 전환 시 true 로 바꾸면 로그인 사용자 전체에게 열린다.
 */
export const PAID_TESTERS_PUBLIC_ORDERING = false;

export function canOrderPaidTesters(user: { role: string } | null): boolean {
  if (!user) return false;
  return PAID_TESTERS_PUBLIC_ORDERING || user.role === "admin";
}

/** 토스 orderId 규칙: 6~64자, [A-Za-z0-9_-] 만 허용. */
export function newPaidOrderCode(): string {
  return `pt_${crypto.randomUUID().replace(/-/g, "")}`;
}
