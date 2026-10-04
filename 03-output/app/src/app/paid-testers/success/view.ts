import type { ConfirmPaidOrderResult } from "@/lib/paid-orders";

type OrderSummary = Extract<ConfirmPaidOrderResult, { ok: true }>["order"];

/** 결제창이 돌려준 오류 코드는 이 형식일 때만 화면에 보여준다 — 쿼리 값은 외부 입력이다 */
const SAFE_CODE_PATTERN = /^[A-Za-z0-9_]{1,40}$/;

export const GENERIC_FAILURE_MESSAGE =
  "결제를 확인하지 못했습니다. 로그인한 뒤 콘솔에서 주문 상태를 확인해주세요.";

export type PaymentResultView =
  | {
      kind: "success";
      /** 구매자 본인에게만 주문 내용을 보여준다. null 이면 "결제가 확인되었습니다"만 */
      order: OrderSummary | null;
    }
  | {
      kind: "failure";
      title: string;
      message: string;
      /** 결제창 오류 코드 (형식이 안전할 때만) */
      code: string | null;
      /** 다시 결제할 수 있는 주문 코드 (구매자 본인 + 결제가 없는 경우만) */
      retryOrderCode: string | null;
      /** "카드 승인 후 문제는 자동 복구된다 — 새로고침" 안내를 붙일지 */
      showRecoveryHint: boolean;
    };

/**
 * 결제 후 돌아온 화면에 무엇을 보여줄지 — 판단만 하는 순수 함수.
 * - 결제창이 실패 코드를 돌려줬어도(windowCode) PG 가 승인했을 수 있으므로 확정 결과(result)가 우선이다.
 * - 쿼리의 message 는 쓰지 않는다 (외부 입력). 실패 문구는 서버가 만든 것 또는 고정 문구.
 * - 주문 내용·구체적인 실패 사유는 구매자 본인에게만 보여준다. 확정 자체는 세션이 없어도 돌았다.
 */
export function paymentResultView(input: {
  result: ConfirmPaidOrderResult;
  viewerIsBuyer: boolean;
  windowCode: unknown;
  orderCode: string | null;
}): PaymentResultView {
  const { result, viewerIsBuyer, windowCode, orderCode } = input;
  if (result.ok) return { kind: "success", order: viewerIsBuyer ? result.order : null };

  const windowFailed = typeof windowCode === "string" && windowCode.length > 0;
  return {
    kind: "failure",
    title: windowFailed ? "결제가 완료되지 않았습니다" : "결제 확인에 실패했습니다",
    message: viewerIsBuyer ? result.message : GENERIC_FAILURE_MESSAGE,
    code: windowFailed && SAFE_CODE_PATTERN.test(windowCode) ? windowCode : null,
    retryOrderCode: viewerIsBuyer && result.reason === "not_paid" ? orderCode : null,
    showRecoveryHint: !windowFailed,
  };
}
