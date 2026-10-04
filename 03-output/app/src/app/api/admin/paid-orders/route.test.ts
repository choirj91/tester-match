// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/admin", () => ({
  getAdminUser: vi.fn(async () => ({ id: 1, role: "admin", nickname: "운영자" })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/console-data", () => ({ ensureOrderSlots: vi.fn() }));
vi.mock("@/lib/paid-seats", () => ({
  SEAT_FILLED_MATCH_STATUSES: ["active", "completed"],
  closeOrderSeats: vi.fn(),
  settleOrderIfDone: vi.fn(),
  refundCreditsOrder: vi.fn(async () => ({ kind: "toss", ok: true })),
  isCreditsPaidOrder: vi.fn(async () => false),
}));
vi.mock("@/lib/portone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portone")>()),
  lookupPortOnePayment: vi.fn(),
}));
vi.mock("@/lib/paid-orders", () => ({ confirmPaidTesterOrder: vi.fn() }));

import { confirmPaidTesterOrder } from "@/lib/paid-orders";
import { isCreditsPaidOrder } from "@/lib/paid-seats";
import { lookupPortOnePayment, type PortOneLookup } from "@/lib/portone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "./route";

const ORDER_CODE = "pt_0123456789abcdef0123456789abcdef";

type Call = {
  table: string;
  op: "select" | "update";
  filters: Record<string, unknown>;
  values?: Record<string, unknown>;
};

/** 주문 한 건이 있는 DB — 참여 테스터 0명, 상태 갱신은 항상 성공. 호출은 calls 에 남긴다. */
function stubDb(orderOverrides: Record<string, unknown> = {}) {
  const order = {
    id: 7,
    order_code: ORDER_CODE,
    status: "pending",
    amount_krw: 3000,
    fulfillment: "community",
    seats_closed: false,
    refund_due_krw: 0,
    refunded_krw: 0,
    admin_note: null,
    ...orderOverrides,
  };
  const calls: Call[] = [];
  const respond = (call: Call) => {
    if (call.table === "matches") return { count: 0, error: null };
    if (call.op === "update") return { data: [{ id: order.id }], error: null };
    return { data: order, error: null };
  };
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: {} };
    calls.push(call);
    const builder: Record<string, unknown> = {
      select: () => builder,
      in: () => builder,
      update(values: Record<string, unknown>) {
        call.op = "update";
        call.values = values;
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters[column] = value;
        return builder;
      },
      maybeSingle: () => Promise.resolve(respond(call)),
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(respond(call)).then(resolve),
    };
    return builder;
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return calls;
}

const cancel = () =>
  PATCH(
    new Request("http://localhost/api/admin/paid-orders", {
      method: "PATCH",
      body: JSON.stringify({ id: 7, action: "cancel" }),
    }),
  );
const CHANNEL_KEY = "channel-key-live";
const found = (status: string, overrides: Record<string, unknown> = {}): PortOneLookup => ({
  kind: "found",
  payment: {
    id: ORDER_CODE,
    status,
    totalAmount: 3000,
    paidAmount: 3000,
    currency: "KRW",
    channelKey: CHANNEL_KEY,
    channelType: "LIVE",
    transactionId: "tx_1",
    ...overrides,
  },
});
const stubLookup = (lookup: PortOneLookup) =>
  vi.mocked(lookupPortOnePayment).mockResolvedValue(lookup);
const cancelUpdates = (calls: Call[]) =>
  calls.filter((c) => c.op === "update" && c.values?.status === "canceled");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PORTONE_CHANNEL_KEY", CHANNEL_KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("PATCH cancel — 미결제(pending) 카드 주문", () => {
  test("포트원에 결제가 완료돼 있으면 취소하지 않고 바로 확정(복구)한 뒤 409 로 알린다", async () => {
    const calls = stubDb();
    stubLookup(found("PAID"));
    vi.mocked(confirmPaidTesterOrder).mockResolvedValue({
      ok: true,
      alreadyPaid: false,
      order: { orderCode: ORDER_CODE, appName: "가계부", testerCount: 3, amountKrw: 3000 },
    });

    const res = await cancel();

    expect(res.status).toBe(409);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("결제");
    expect(body.message).toContain("새로고침");
    expect(lookupPortOnePayment).toHaveBeenCalledWith(ORDER_CODE);
    expect(confirmPaidTesterOrder).toHaveBeenCalledWith({ orderId: ORDER_CODE });
    expect(cancelUpdates(calls)).toEqual([]);
  });

  test("결제는 됐는데 반영에 실패해도 취소하지 않는다 (409, 사유 포함)", async () => {
    const calls = stubDb();
    stubLookup(found("PAID"));
    vi.mocked(confirmPaidTesterOrder).mockResolvedValue({
      ok: false,
      reason: "needs_review",
      message: "금액이 다릅니다",
    });

    const res = await cancel();

    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toContain("금액이 다릅니다");
    expect(cancelUpdates(calls)).toEqual([]);
  });

  test.each<[string, PortOneLookup, string]>([
    ["결제 상태를 조회하지 못함", { kind: "error" }, "조회 실패"],
    ["승인 대기(PENDING)", found("PENDING"), "PENDING"],
    ["결제 완료이나 다른 채널", found("PAID", { channelKey: "channel-key-test", channelType: "TEST" }), "TEST"],
    ["결제 완료이나 금액이 다름", found("PAID", { totalAmount: 1000, paidAmount: 1000 }), "1,000"],
  ])("%s 이면 스윕과 같은 판정(보류)으로 취소하지 않고 사유를 알린다 (409)", async (_label, lookup, text) => {
    const calls = stubDb();
    stubLookup(lookup);

    const res = await cancel();

    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toContain(text);
    expect(confirmPaidTesterOrder).not.toHaveBeenCalled();
    expect(cancelUpdates(calls)).toEqual([]);
  });

  test.each<[string, PortOneLookup]>([
    ["결제 없음", { kind: "not_found" }],
    ["결제창만 연 상태(READY)", found("READY")],
    ["결제 실패(FAILED)", found("FAILED")],
  ])("%s 이면 기존대로 취소한다", async (_label, lookup) => {
    const calls = stubDb();
    stubLookup(lookup);

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(confirmPaidTesterOrder).not.toHaveBeenCalled();
    expect(cancelUpdates(calls)).toHaveLength(1);
    expect(cancelUpdates(calls)[0].filters).toMatchObject({ id: 7, status: "pending" });
  });

  test("크레딧으로 결제한 주문은 포트원을 조회하지 않고 취소한다", async () => {
    const calls = stubDb();
    vi.mocked(isCreditsPaidOrder).mockResolvedValueOnce(true);

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(lookupPortOnePayment).not.toHaveBeenCalled();
    expect(cancelUpdates(calls)).toHaveLength(1);
  });
});

describe("PATCH cancel — 이미 결제된 주문", () => {
  test("결제 조회 없이 기존 취소·환불 절차를 그대로 탄다", async () => {
    const calls = stubDb({ status: "paid" });

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(lookupPortOnePayment).not.toHaveBeenCalled();
    expect(cancelUpdates(calls)).toHaveLength(1);
  });
});
