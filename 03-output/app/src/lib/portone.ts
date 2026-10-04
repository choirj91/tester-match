/**
 * 포트원 V2 REST 래퍼 — edge runtime 호환 (SDK 없이 fetch 직접 호출).
 * 카드정보는 PG(NHN KCP)가 보관한다. 우리는 결제 ID(= 주문 코드)·거래 ID·금액·상태만 다룬다.
 *
 * 포트원에는 서버 "승인(confirm)" 단계가 없다 — PG 승인은 결제창 안에서 끝난다.
 * 서버는 결제를 조회해 상태와 금액을 주문과 대조할 뿐이다.
 */

import { PAID_TESTERS_PUBLIC_ORDERING } from "@/lib/paid-testers";

const PORTONE_PAYMENTS_API = "https://api.portone.io/payments";
const PORTONE_NOT_FOUND_TYPE = "PAYMENT_NOT_FOUND";

/** 결제 완료 상태 — 이 상태 + 금액 일치일 때만 주문을 확정한다 */
export const PORTONE_PAID_STATUS = "PAID";

export type PortOnePayment = {
  /** 결제 ID — 우리 주문 코드(order_code) */
  id: string;
  status: string;
  totalAmount: number;
  /** 실제 결제된 금액 (amount.paid) — 응답에 있을 때만 */
  paidAmount?: number;
  /** 통화·채널은 결제 완료(PAID) 응답에는 반드시 있다 (없으면 조회 실패로 처리) */
  currency?: string;
  /** 결제가 이뤄진 채널의 키 — 우리 채널(NEXT_PUBLIC_PORTONE_CHANNEL_KEY)인지 대조한다 */
  channelKey?: string;
  /** "LIVE" | "TEST" */
  channelType?: string;
  /** 결제창을 연 뒤에 생긴다. 승인된 결제에는 항상 있다 */
  transactionId?: string;
  paidAt?: string;
};

export type PortOneLookup =
  | { kind: "found"; payment: PortOnePayment }
  | { kind: "not_found" }
  | { kind: "error" };

const LOOKUP_TIMEOUT_MS = 8000;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const isAbsent = (value: unknown): boolean => value === undefined || value === null;

/**
 * 주문 확정·스윕·관리자 취소가 결제를 대조할 때 쓰는 기대값.
 * 채널 키는 우리 결제 채널 (미설정이면 undefined — 확정하지 않는다).
 * 주문을 일반에 공개한 뒤(PAID_TESTERS_PUBLIC_ORDERING)에는 실결제(LIVE) 채널 결제만 인정한다.
 */
export function expectedPortOnePayment(amountKrw: number): {
  amountKrw: number;
  channelKey: string | undefined;
  requireLiveChannel: boolean;
} {
  return {
    amountKrw,
    channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || undefined,
    requireLiveChannel: PAID_TESTERS_PUBLIC_ORDERING,
  };
}

type ParsedChannel = { key: string; type: string } | undefined | null;

/** channel: 없으면 undefined, 형식이 다르면 null */
function parseChannel(value: unknown): ParsedChannel {
  if (isAbsent(value)) return undefined;
  if (typeof value !== "object") return null;
  const { key, type } = value as Record<string, unknown>;
  return typeof key === "string" && key && typeof type === "string" && type ? { key, type } : null;
}

/** 응답 본문에서 우리가 쓰는 필드만 고른다. 형식이 다르면 null (조회 실패로 처리) */
function parsePayment(body: unknown, paymentId: string): PortOnePayment | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const amount = data.amount as Record<string, unknown> | null | undefined;
  const total = amount && typeof amount === "object" ? amount.total : undefined;
  if (data.id !== paymentId || typeof data.status !== "string" || !Number.isInteger(total)) {
    return null;
  }
  const paid = (amount as Record<string, unknown>).paid;
  const channel = parseChannel(data.channel);
  // 있는데 형식이 다르면 깨진 본문이다
  if (!isAbsent(paid) && !Number.isInteger(paid)) return null;
  if (!isAbsent(data.currency) && typeof data.currency !== "string") return null;
  if (channel === null) return null;
  const currency = optionalString(data.currency);
  // 결제 완료를 검증하려면 통화·채널이 있어야 한다 — 없으면 "결제 완료"로도 "결제 없음"으로도 읽지 않는다
  if (data.status === PORTONE_PAID_STATUS && (!currency || !channel)) return null;
  const transactionId = optionalString(data.transactionId);
  const paidAt = optionalString(data.paidAt);
  return {
    id: paymentId,
    status: data.status,
    totalAmount: total as number,
    ...(isAbsent(paid) ? {} : { paidAmount: paid as number }),
    ...(currency ? { currency } : {}),
    ...(channel ? { channelKey: channel.key, channelType: channel.type } : {}),
    ...(transactionId ? { transactionId } : {}),
    ...(paidAt ? { paidAt } : {}),
  };
}

/**
 * 결제 ID(= 주문 코드)로 결제 조회 — 주문 확정과 미결제 주문 스윕이 함께 쓴다.
 * "결제 없음"(404 PAYMENT_NOT_FOUND)과 "조회 실패"(시크릿 미설정·통신 오류·시간 초과·그 외 응답·깨진 본문)를 구분한다 —
 * 실패를 미결제로 읽으면 결제된 주문을 취소하게 된다.
 */
export async function lookupPortOnePayment(paymentId: string): Promise<PortOneLookup> {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) return { kind: "error" };
  try {
    const res = await fetch(`${PORTONE_PAYMENTS_API}/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${apiSecret}` },
      // 응답이 없으면 끊는다 — 예외가 되어 아래에서 조회 실패로 처리된다
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.status === 404 && body?.type === PORTONE_NOT_FOUND_TYPE) return { kind: "not_found" };
    if (!res.ok) {
      console.error("[portone] lookup failed", res.status, body?.type);
      return { kind: "error" };
    }
    const payment = parsePayment(body, paymentId);
    if (!payment) {
      console.error("[portone] lookup returned an unexpected body", paymentId);
      return { kind: "error" };
    }
    return { kind: "found", payment };
  } catch (err) {
    console.error("[portone] lookup exception", err);
    return { kind: "error" };
  }
}
