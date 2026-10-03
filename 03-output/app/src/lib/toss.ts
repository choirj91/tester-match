/**
 * 토스페이먼츠 REST 래퍼 — edge runtime 호환 (SDK 없이 fetch 직접 호출).
 * 카드정보는 토스가 보관한다. 우리는 paymentKey/orderId/금액/상태만 다룬다.
 */

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  totalAmount: number;
  status: string;
  approvedAt?: string;
  method?: string;
};

export type TossConfirmResult =
  | { ok: true; payment: TossPayment }
  | { ok: false; code: string; message: string; httpStatus: number };

const TOSS_CONFIRM_API = "https://api.tosspayments.com/v1/payments/confirm";

/** 이미 승인된 결제의 재승인 시도 — 멱등 재시도 경로에서 성공으로 취급한다. */
export const TOSS_ALREADY_PROCESSED = "ALREADY_PROCESSED_PAYMENT";

export async function confirmTossPayment(args: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResult> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return {
      ok: false,
      code: "NO_SECRET_KEY",
      message: "결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.",
      httpStatus: 0,
    };
  }

  try {
    const res = await fetch(TOSS_CONFIRM_API, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${secretKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        code: typeof data.code === "string" ? data.code : "UNKNOWN",
        message:
          typeof data.message === "string" ? data.message : "결제 승인에 실패했습니다.",
        httpStatus: res.status,
      };
    }
    return { ok: true, payment: data as unknown as TossPayment };
  } catch (err) {
    console.error("[toss] confirm exception", err);
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "결제 승인 통신에 실패했습니다. 잠시 후 다시 시도해주세요.",
      httpStatus: 0,
    };
  }
}

export type TossLookup =
  | { kind: "found"; payment: TossPayment }
  | { kind: "not_found" }
  | { kind: "error" };

/**
 * orderId 로 결제 조회 — 승인은 됐는데 우리 DB 반영이 누락된 주문의 복구·검증용.
 * "결제 없음"(404·키 미설정)과 "조회 실패"를 구분한다 — 실패를 미결제로 읽으면 결제된 주문을 취소하게 된다.
 */
export async function lookupTossPaymentByOrderId(orderId: string): Promise<TossLookup> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return { kind: "not_found" };
  try {
    const res = await fetch(
      `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` } },
    );
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) return { kind: "error" };
    return { kind: "found", payment: (await res.json()) as TossPayment };
  } catch (err) {
    console.error("[toss] lookup exception", err);
    return { kind: "error" };
  }
}

export async function fetchTossPaymentByOrderId(orderId: string): Promise<TossPayment | null> {
  const result = await lookupTossPaymentByOrderId(orderId);
  return result.kind === "found" ? result.payment : null;
}
