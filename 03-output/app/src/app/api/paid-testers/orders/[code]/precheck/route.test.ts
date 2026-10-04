// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/paid-orders", () => ({ confirmPaidTesterOrder: vi.fn() }));

import { getCurrentUser } from "@/lib/auth";
import { confirmPaidTesterOrder, type ConfirmPaidOrderResult } from "@/lib/paid-orders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

const ORDER_CODE = "pt_0123456789abcdef0123456789abcdef";
const BUYER_ID = 11;

function stubOrder(row: { buyer_user_id: number } | null, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error }),
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: () => builder } as never);
}
const stubUser = (id: number | null) =>
  vi.mocked(getCurrentUser).mockResolvedValue((id === null ? null : { id, role: "user" }) as never);
const stubConfirm = (result: ConfirmPaidOrderResult) => vi.mocked(confirmPaidTesterOrder).mockResolvedValue(result);
const precheck = (code = ORDER_CODE) =>
  POST(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ code }) });
const failure = (
  reason: "not_paid" | "retry" | "closed" | "needs_review" | "payment_unsettled",
  message = "사유"): ConfirmPaidOrderResult => ({
  ok: false,
  reason,
  message,
});

beforeEach(() => {
  stubUser(BUYER_ID);
  stubOrder({ buyer_user_id: BUYER_ID });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST precheck", () => {
  test("로그인하지 않았으면 401 — 확정을 돌리지 않는다", async () => {
    stubUser(null);

    expect((await precheck()).status).toBe(401);
    expect(confirmPaidTesterOrder).not.toHaveBeenCalled();
  });

  test.each<[string, () => void, string]>([
    ["남의 주문", () => stubOrder({ buyer_user_id: 99 }), ORDER_CODE],
    ["없는 주문", () => stubOrder(null), ORDER_CODE],
    ["주문 코드 형식이 아님", () => {}, "not-a-code"],
    ["주문 코드 뒤에 다른 문자열", () => {}, `${ORDER_CODE}x`],
  ])("%s 이면 404 — 확정을 돌리지 않는다", async (_label, arrange, code) => {
    arrange();

    expect((await precheck(code)).status).toBe(404);
    expect(confirmPaidTesterOrder).not.toHaveBeenCalled();
  });

  test("미결제이고 포트원에도 결제가 없으면 payable", async () => {
    stubConfirm(failure("not_paid"));

    const res = await precheck();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "payable" });
    expect(confirmPaidTesterOrder).toHaveBeenCalledWith({ orderId: ORDER_CODE });
  });

  test("이미 결제돼 있으면(방금 반영 포함) paid", async () => {
    stubConfirm({
      ok: true,
      alreadyPaid: true,
      order: { orderCode: ORDER_CODE, appName: "가계부", testerCount: 3, amountKrw: 3000 },
    });

    expect(await (await precheck()).json()).toEqual({ state: "paid" });
  });

  test.each(["closed", "needs_review", "payment_unsettled"] as const)("결제할 수 없는 주문(%s)이면 closed 와 안내 문구", async (reason) => {
    stubConfirm(failure(reason, "이미 취소되었거나 환불된 주문입니다."));

    const res = await precheck();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "closed", message: "이미 취소되었거나 환불된 주문입니다." });
  });

  test("결제 상태를 확인할 수 없으면 500 과 다시 시도 안내 — payable 이라고 하지 않는다", async () => {
    stubConfirm(failure("retry"));

    const res = await precheck();

    expect(res.status).toBe(500);
    const body = (await res.json()) as { state?: string; message: string };
    expect(body.state).toBeUndefined();
    expect(body.message).toContain("다시 시도");
  });

  test("주문 조회가 실패해도 500", async () => {
    stubOrder(null, { message: "db down" });

    expect((await precheck()).status).toBe(500);
    expect(confirmPaidTesterOrder).not.toHaveBeenCalled();
  });
});
