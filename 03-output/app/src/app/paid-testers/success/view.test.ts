import { describe, expect, test } from "vitest";
import type { ConfirmPaidOrderResult } from "@/lib/paid-orders";
import { GENERIC_FAILURE_MESSAGE, paymentResultView } from "./view";

const ORDER_CODE = "pt_0123456789abcdef0123456789abcdef";
const order = { orderCode: ORDER_CODE, appName: "가계부", testerCount: 3, amountKrw: 3000 };
const paid: ConfirmPaidOrderResult = { ok: true, alreadyPaid: false, order };
const notPaid: ConfirmPaidOrderResult = { ok: false, reason: "not_paid", message: "결제가 완료되지 않았습니다." };
const base = { viewerIsBuyer: true, windowCode: undefined, orderCode: ORDER_CODE };

describe("paymentResultView", () => {
  test("확정됐고 구매자 본인이면 주문 내용을 보여준다", () => {
    expect(paymentResultView({ ...base, result: paid })).toEqual({ kind: "success", order });
  });

  test("확정됐지만 구매자가 아니면(로그아웃 포함) 주문 내용 없이 확인됐다고만 한다", () => {
    expect(paymentResultView({ ...base, result: paid, viewerIsBuyer: false })).toEqual({
      kind: "success",
      order: null,
    });
  });

  test("결제창이 실패 코드를 돌려줬어도 확정됐으면 성공이다", () => {
    expect(paymentResultView({ ...base, result: paid, windowCode: "FAILURE_TYPE_PG" }).kind).toBe("success");
  });

  test("결제창 실패 + 결제 없음: 서버 문구와 코드를 보여주고 다시 결제할 수 있게 한다", () => {
    expect(paymentResultView({ ...base, result: notPaid, windowCode: "FAILURE_TYPE_PG" })).toEqual({
      kind: "failure",
      title: "결제가 완료되지 않았습니다",
      message: "결제가 완료되지 않았습니다.",
      code: "FAILURE_TYPE_PG",
      retryOrderCode: ORDER_CODE,
      showRecoveryHint: false,
    });
  });

  test.each(["<script>alert(1)</script>", "코드", "a b", "x".repeat(41), ["A", "B"]])(
    "형식이 안전하지 않은 코드(%j)는 보여주지 않는다",
    (windowCode) => {
      const view = paymentResultView({ ...base, result: notPaid, windowCode });
      expect(view.kind === "failure" && view.code).toBeNull();
    },
  );

  test("결제창 실패 없이 확정만 실패하면 복구 안내를 붙인다", () => {
    const view = paymentResultView({
      ...base,
      result: { ok: false, reason: "retry", message: "잠시 후 새로고침해주세요." },
    });
    expect(view).toMatchObject({
      kind: "failure",
      title: "결제 확인에 실패했습니다",
      message: "잠시 후 새로고침해주세요.",
      code: null,
      retryOrderCode: null,
      showRecoveryHint: true,
    });
  });

  test("구매자가 아니면 실패 사유 대신 고정 문구만 보여주고 다시 결제 링크도 없다", () => {
    const view = paymentResultView({
      ...base,
      viewerIsBuyer: false,
      windowCode: "FAILURE_TYPE_PG",
      result: { ok: false, reason: "closed", message: "이미 취소된 주문에 결제가 완료되었습니다." },
    });
    expect(view).toMatchObject({ kind: "failure", message: GENERIC_FAILURE_MESSAGE, retryOrderCode: null });
  });

  test.each(["closed", "needs_review", "payment_unsettled", "retry", "not_found"] as const)(
    "결제가 없는 경우가 아니면(%s) 다시 결제 링크를 주지 않는다",
    (reason) => {
      const view = paymentResultView({ ...base, result: { ok: false, reason, message: "x" } });
      expect(view.kind === "failure" && view.retryOrderCode).toBeNull();
    },
  );
});
