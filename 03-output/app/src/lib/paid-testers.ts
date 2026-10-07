/**
 * 유료 운영자 테스터 상품 (ADR-0011) — 상수·헬퍼.
 * 단가는 잠금 결정 3(ADR-0017: 테스터 시트 1명 = 1,100원, 부가세 포함)을 따른다.
 */

export const PAID_TESTER_PRICE_KRW = 1100;
export const PAID_TESTER_MIN_COUNT = 1;
export const PAID_TESTER_MAX_COUNT = 30;
/** 주문 폼 기본 인원 — Google 요건 12명 + 14일 사이 이탈 대비 2명 */
export const PAID_TESTER_RECOMMENDED_COUNT = 14;

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

/** 결제창에 넘기는 주문명은 최대 100자로 맞춘다 — 초과 시 앱 이름을 축약한다. */
export function paidTesterOrderName(appName: string, testerCount: number): string {
  const suffix = ` 테스터 ${testerCount}명 (14일)`;
  const maxAppNameLength = 100 - suffix.length;
  const name =
    appName.length > maxAppNameLength ? `${appName.slice(0, maxAppNameLength - 1)}…` : appName;
  return `${name}${suffix}`;
}

/**
 * 주문 오픈 게이트. 결제(PG) 실연동 전환 전까지 운영자만 주문 가능 —
 * 테스트 채널 상태에서 일반 유저가 "가상 결제" 로 주문을 만드는 것을 막는다.
 * 라이브 전환 시 true 로 바꾸면 로그인 사용자 전체에게 열린다.
 */
export const PAID_TESTERS_PUBLIC_ORDERING = false;

type OrderGateUser = { role: string; email?: string | null };

/** 공개 전에도 주문을 허용할 계정 (결제대행사 심사 계정 등) — 서버 환경변수, 쉼표 구분 이메일 */
export function isOrderAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.PAID_TESTERS_ORDER_ALLOWLIST ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export function canOrderPaidTesters(user: OrderGateUser | null): boolean {
  if (!user) return false;
  return (
    PAID_TESTERS_PUBLIC_ORDERING || user.role === "admin" || isOrderAllowlisted(user.email)
  );
}

/**
 * 심사·시험용 주문 여부. 공개 전 허용목록 계정의 주문은 결제 흐름만 통과시키고
 * 시트를 열지 않으며(급구·전 회원 알림 없음) 매칭 중이 아닌 앱에도 허용한다.
 */
export function isReviewOrderer(user: OrderGateUser): boolean {
  return (
    !PAID_TESTERS_PUBLIC_ORDERING && user.role !== "admin" && isOrderAllowlisted(user.email)
  );
}

/**
 * 주문 코드 — 포트원 결제 ID(paymentId)로 그대로 쓴다.
 * 결제 ID 규칙(KG이니시스·NHN KCP 모두 안전): ASCII 만, 최대 40자 → "pt_" + 32자리 hex = 35자.
 */
export function newPaidOrderCode(): string {
  return `pt_${crypto.randomUUID().replace(/-/g, "")}`;
}

const PAID_ORDER_CODE_PREFIX_PATTERN = /^pt_[0-9a-f]{32}/;

/**
 * 쿼리 파라미터에서 주문 코드를 골라낸다 (결제 후 돌아온 URL — 외부 입력).
 * 리디렉션 과정에서 뒤에 다른 문자열이 붙어 와도 앞의 주문 코드만 쓴다. 주문 코드가 아니면 null.
 */
export function extractPaidOrderCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.match(PAID_ORDER_CODE_PREFIX_PATTERN)?.[0] ?? null;
}
