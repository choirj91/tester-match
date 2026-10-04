import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/portone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portone")>()),
  lookupPortOnePayment: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  getAdminNotifyEmail: vi.fn(() => "admin@example.com"),
}));
vi.mock("@/lib/paid-seats", () => ({ activatePaidOrder: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/credits", () => ({ appendLedger: vi.fn() }));

import { sendEmail } from "@/lib/email";
import { hasAttentionNote } from "@/lib/paid-order-sweep-rules";
import { activatePaidOrder } from "@/lib/paid-seats";
import { lookupPortOnePayment, type PortOneLookup, type PortOnePayment } from "@/lib/portone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmPaidTesterOrder } from "./paid-orders";

const ORDER_CODE = "pt_0123456789abcdef0123456789abcdef";

type Result = { data?: unknown; error?: { code?: string; message: string } | null };
type Call = {
  table: string;
  op: "select" | "insert" | "update";
  filters: Record<string, unknown>;
  values?: Record<string, unknown>;
};

/** PostgREST 쿼리 빌더 흉내 — 체인은 자기 자신을 돌려주고, await 하면 미리 정한 결과를 준다. 호출은 calls 에 남긴다. */
function fakeSupabase(respond: (call: Call) => Result) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: {} };
    calls.push(call);
    const builder: Record<string, unknown> = {
      // update().select() 는 갱신된 행을 돌려받는 것 — 연산 종류를 바꾸지 않는다
      select: () => builder,
      insert(values: Record<string, unknown>) {
        call.op = "insert";
        call.values = values;
        return builder;
      },
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
      then: (resolve: (r: Result) => unknown) => Promise.resolve(respond(call)).then(resolve),
    };
    return builder;
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return calls;
}

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  order_code: ORDER_CODE,
  app_id: 3,
  buyer_user_id: 11,
  tester_count: 3,
  amount_krw: 3000,
  status: "pending",
  seats_closed: false,
  paid_at: null,
  admin_note: null,
  apps: { name: "가계부" },
  ...overrides,
});

const CHANNEL_KEY = "channel-key-live";

const found = (
  status: string,
  totalAmount = 3000,
  transactionId: string | null = "tx_1",
  overrides: Partial<PortOnePayment> = {},
): PortOneLookup => ({
  kind: "found",
  payment: {
    id: ORDER_CODE,
    status,
    totalAmount,
    paidAmount: totalAmount,
    currency: "KRW",
    channelKey: CHANNEL_KEY,
    channelType: "LIVE",
    ...(transactionId ? { transactionId } : {}),
    ...overrides,
  },
});

type OrderRow = ReturnType<typeof order>;

/**
 * 주문 한 건이 있는 DB. transitions=false 면 조건부 전이가 0행 (다른 호출이 먼저 전이했거나 그 사이 취소됨).
 * reread 는 전이 0행 뒤 상태 재확인(주문 두 번째 조회)이 돌려줄 행.
 */
function stubDb(
  row: OrderRow | null,
  options: {
    transitions?: boolean;
    insertError?: Result["error"];
    reread?: OrderRow | null;
    noteError?: Result["error"];
  } = {},
) {
  const { transitions = true, insertError = null, noteError = null } = options;
  let orderReads = 0;
  return fakeSupabase((call) => {
    if (call.table === "paid_tester_orders" && call.op === "select") {
      orderReads += 1;
      return { data: orderReads > 1 && "reread" in options ? options.reread : row, error: null };
    }
    if (call.table === "payments" && call.op === "insert") return { error: insertError };
    if (call.table === "payments") return { data: { id: 99 }, error: null };
    if (call.table === "paid_tester_orders" && call.op === "update") {
      // 메모만 쓰는 갱신은 항상 성공, 상태 전이는 transitions 에 따른다
      if (call.values?.status !== "paid") return { data: null, error: noteError };
      return { data: transitions ? [{ id: 7 }] : [], error: null };
    }
    if (call.table === "users") return { data: { email: "buyer@example.com", nickname: "구매자" }, error: null };
    return { data: null, error: null };
  });
}

const writes = (calls: Call[]) => calls.filter((c) => c.op !== "select");
const stubLookup = (lookup: PortOneLookup) =>
  vi.mocked(lookupPortOnePayment).mockResolvedValue(lookup);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PORTONE_CHANNEL_KEY", CHANNEL_KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const noteWrites = (calls: Call[]) => writes(calls).filter((c) => "admin_note" in (c.values ?? {}));

describe("confirmPaidTesterOrder — 미결제(pending) 주문", () => {
  test("포트원이 결제 완료 + 금액 일치면 결제를 기록하고 주문을 확정한다", async () => {
    const calls = stubDb(order());
    stubLookup(found("PAID"));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toEqual({
      ok: true,
      alreadyPaid: false,
      order: { orderCode: ORDER_CODE, appName: "가계부", testerCount: 3, amountKrw: 3000 },
    });
    expect(lookupPortOnePayment).toHaveBeenCalledWith(ORDER_CODE);
    const [insert, update] = writes(calls);
    // 결제 기록의 멱등 키는 포트원 결제 ID(= 주문 코드) — 거래 ID 와 무관하게 주문당 하나
    expect(insert).toMatchObject({
      table: "payments",
      op: "insert",
      values: { provider: "portone", provider_tx_id: ORDER_CODE, amount_krw: 3000, user_id: 11, status: "completed" },
    });
    expect(calls.find((c) => c.table === "payments" && c.op === "select")?.filters).toEqual({
      provider_tx_id: ORDER_CODE,
    });
    expect(update).toMatchObject({
      table: "paid_tester_orders",
      op: "update",
      filters: { id: 7, status: "pending" },
      values: { status: "paid", payment_id: 99, payment_key: "tx_1" },
    });
    expect(activatePaidOrder).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test("거래 ID 가 없어도 결제 기록 키는 결제 ID 이고, 주문의 payment_key 만 비운다", async () => {
    const calls = stubDb(order());
    stubLookup(found("PAID", 3000, null));

    await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    const [insert, update] = writes(calls);
    expect(insert.values).toMatchObject({ provider_tx_id: ORDER_CODE });
    expect(update.values).toMatchObject({ status: "paid", payment_key: null });
  });

  test("결제 기록 저장이 중복 외의 이유로 실패하면 주문을 확정하지 않는다", async () => {
    const calls = stubDb(order(), { insertError: { code: "23514", message: "check violation" } });
    stubLookup(found("PAID"));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(writes(calls).filter((c) => c.op === "update")).toEqual([]);
  });

  test("조회 실패는 취소가 아니라 다시 시도할 수 있는 실패다 — 아무것도 쓰지 않는다", async () => {
    const calls = stubDb(order());
    stubLookup({ kind: "error" });

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.message).toContain("새로고침");
    expect(writes(calls)).toEqual([]);
  });

  test.each<[string, PortOneLookup]>([
    ["결제 없음", { kind: "not_found" }],
    ["결제창만 연 상태(READY)", found("READY")],
    ["결제 실패(FAILED)", found("FAILED")],
    ["승인 대기(PENDING)", found("PENDING")],
  ])("%s 이면 확정하지 않고 아무것도 쓰지 않는다", async (_label, lookup) => {
    const calls = stubDb(order());
    stubLookup(lookup);

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(writes(calls)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("confirmPaidTesterOrder — 결제 금액이 주문 금액과 다를 때", () => {
  test("확정하지 않고 주문은 pending 인 채로 확인 필요 메모(결제 금액·주문 금액)만 남긴다", async () => {
    const calls = stubDb(order({ admin_note: "기존 메모" }));
    stubLookup(found("PAID", 1000));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("금액");
    expect(!result.ok && result.message).toContain("운영자");
    const [noteWrite, ...rest] = writes(calls);
    expect(rest).toEqual([]);
    expect(noteWrite).toMatchObject({ table: "paid_tester_orders", op: "update", filters: { id: 7, status: "pending" } });
    expect(Object.keys(noteWrite.values ?? {})).toEqual(["admin_note"]);
    const note = String(noteWrite.values?.admin_note);
    expect(hasAttentionNote(note)).toBe(true);
    expect(note).toContain("1,000원");
    expect(note).toContain("3,000원");
    expect(note).toContain("기존 메모");
    expect(activatePaidOrder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("메모를 이미 남겼으면 새로고침해도 다시 쓰지 않는다 (멱등)", async () => {
    const first = stubDb(order());
    stubLookup(found("PAID", 1000));
    await confirmPaidTesterOrder({ orderId: ORDER_CODE });
    const note = writes(first)[0].values?.admin_note;

    const second = stubDb(order({ admin_note: note }));
    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(writes(second)).toEqual([]);
  });
});

describe("confirmPaidTesterOrder — 전이가 0행일 때 (동시 호출·취소와의 경합)", () => {
  const lostRace = (reread: OrderRow | null) => {
    const calls = stubDb(order(), {
      transitions: false,
      insertError: { code: "23505", message: "duplicate key" },
      reread,
    });
    stubLookup(found("PAID"));
    return calls;
  };

  test.each(["paid", "in_progress", "completed"])(
    "다른 호출이 먼저 확정했으면(%s) 성공으로 답하고 알림은 다시 보내지 않는다",
    async (status) => {
      const calls = lostRace(order({ status, paid_at: "2026-10-05T01:00:00Z" }));

      const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

      expect(result).toMatchObject({ ok: true, alreadyPaid: true });
      expect(noteWrites(calls)).toEqual([]);
      expect(activatePaidOrder).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    },
  );

  test.each(["canceled", "refunded"])(
    "그 사이 주문이 %s 로 바뀌었으면 성공이라 하지 않고 환불 대상 메모를 남긴다",
    async (status) => {
      const calls = lostRace(order({ status, admin_note: "자동 취소 — 24시간 미결제" }));

      const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.message).toContain("환불");
      const [noteWrite, ...rest] = noteWrites(calls);
      expect(rest).toEqual([]);
      expect(noteWrite.filters).toEqual({ id: 7, status });
      const note = String(noteWrite.values?.admin_note);
      expect(hasAttentionNote(note)).toBe(true);
      expect(note).toContain("3,000원");
      expect(note).toContain("자동 취소 — 24시간 미결제");
      expect(activatePaidOrder).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    },
  );

  test("그 사이 확정됐다가 취소·환불까지 된 주문은 기존 환불 절차가 맡는다 — 메모 없이 실패로 답한다", async () => {
    const calls = lostRace(order({ status: "refunded", paid_at: "2026-10-05T01:00:00Z" }));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toEqual({
      ok: false,
      reason: "closed",
      message: "이미 취소되었거나 환불된 주문입니다.",
    });
    expect(noteWrites(calls)).toEqual([]);
  });

  test("취소된 주문에 메모가 이미 있으면 다시 쓰지 않는다 (멱등)", async () => {
    const first = lostRace(order({ status: "canceled" }));
    await confirmPaidTesterOrder({ orderId: ORDER_CODE });
    const note = noteWrites(first)[0].values?.admin_note;

    const second = lostRace(order({ status: "canceled", admin_note: note }));
    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(noteWrites(second)).toEqual([]);
  });

  test.each<[string, OrderRow | null]>([
    ["아직 pending", order()],
    ["주문을 다시 읽지 못함", null],
  ])("%s 이면 성공이라 하지 않고 다시 시도하게 한다", async (_label, reread) => {
    const calls = lostRace(reread);

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("새로고침");
    expect(noteWrites(calls)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("confirmPaidTesterOrder — 이미 처리된 주문", () => {
  test.each(["paid", "in_progress", "completed"])(
    "%s 주문은 포트원을 조회하지 않고 성공으로 답한다 (멱등)",
    async (status) => {
      const calls = stubDb(order({ status, paid_at: "2026-10-05T01:00:00Z" }));

      const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

      expect(result).toMatchObject({ ok: true, alreadyPaid: true });
      expect(lookupPortOnePayment).not.toHaveBeenCalled();
      expect(writes(calls)).toEqual([]);
    },
  );

  test("주문이 없으면 실패한다", async () => {
    stubDb(null);

    expect(await confirmPaidTesterOrder({ orderId: ORDER_CODE })).toMatchObject({ ok: false });
    expect(lookupPortOnePayment).not.toHaveBeenCalled();
  });
});

describe("confirmPaidTesterOrder — 취소된 주문", () => {
  const canceled = (overrides: Record<string, unknown> = {}) =>
    order({ status: "canceled", admin_note: "자동 취소 — 24시간 미결제", ...overrides });

  test("결제 기록 없이 취소된 주문에 결제가 들어와 있으면 확정하지 않고 환불 대상 메모를 남긴다", async () => {
    const calls = stubDb(canceled());
    stubLookup(found("PAID"));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("환불");
    const [noteWrite, ...rest] = writes(calls);
    expect(rest).toEqual([]);
    expect(noteWrite).toMatchObject({
      table: "paid_tester_orders",
      op: "update",
      filters: { id: 7, status: "canceled" },
    });
    expect(Object.keys(noteWrite.values ?? {})).toEqual(["admin_note"]);
    const note = String(noteWrite.values?.admin_note);
    expect(hasAttentionNote(note)).toBe(true);
    expect(note).toContain("3,000원");
    expect(note).toContain("자동 취소 — 24시간 미결제");
    expect(activatePaidOrder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("메모를 이미 남긴 주문은 새로고침해도 다시 쓰지 않는다 (멱등)", async () => {
    const first = stubDb(canceled());
    stubLookup(found("PAID"));
    await confirmPaidTesterOrder({ orderId: ORDER_CODE });
    const note = writes(first)[0].values?.admin_note;

    const second = stubDb(canceled({ admin_note: note }));
    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("환불");
    expect(writes(second)).toEqual([]);
  });

  test.each<[string, PortOneLookup]>([
    ["결제 없음", { kind: "not_found" }],
    ["결제창만 연 상태(READY)", found("READY")],
    ["PG 에서 이미 취소된 결제(CANCELLED)", found("CANCELLED")],
  ])("%s 이면 취소된 주문이라고만 알린다", async (_label, lookup) => {
    const calls = stubDb(canceled());
    stubLookup(lookup);

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toEqual({
      ok: false,
      reason: "closed",
      message: "이미 취소되었거나 환불된 주문입니다.",
    });
    expect(writes(calls)).toEqual([]);
  });

  test("조회에 실패하면 결제 여부를 단정하지 않고 다시 시도하게 한다", async () => {
    const calls = stubDb(canceled());
    stubLookup({ kind: "error" });

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(!result.ok && result.message).toContain("새로고침");
    expect(writes(calls)).toEqual([]);
  });

  test("결제된 뒤 취소·환불된 주문은 기존 환불 절차가 맡는다 — 조회도 메모도 하지 않는다", async () => {
    const calls = stubDb(
      canceled({ paid_at: "2026-10-05T01:00:00Z", admin_note: "관리자 취소 (운영자)" }),
    );

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toEqual({
      ok: false,
      reason: "closed",
      message: "이미 취소되었거나 환불된 주문입니다.",
    });
    expect(lookupPortOnePayment).not.toHaveBeenCalled();
    expect(writes(calls)).toEqual([]);
  });
});

describe("confirmPaidTesterOrder — 결제 검증 (채널·통화·실결제액)과 실패 사유", () => {
  test.each<[string, PortOneLookup, string]>([
    ["다른 채널(테스트 채널)", found("PAID", 3000, "tx_1", { channelKey: "channel-key-test", channelType: "TEST" }), "TEST"],
    ["원화가 아닌 통화", found("PAID", 3000, "tx_1", { currency: "USD" }), "USD"],
    ["실결제액이 총액과 다름", found("PAID", 3000, "tx_1", { paidAmount: 2000 }), "2,000원"],
    ["주문 금액과 다름", found("PAID", 1000), "1,000원"],
  ])("%s 결제는 확정하지 않고 어느 검증이 틀렸는지 메모만 남긴다", async (_label, lookup, text) => {
    const calls = stubDb(order());
    stubLookup(lookup);

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toMatchObject({ ok: false, reason: "needs_review" });
    const [noteWrite, ...rest] = writes(calls);
    expect(rest).toEqual([]);
    expect(noteWrite.filters).toEqual({ id: 7, status: "pending" });
    expect(Object.keys(noteWrite.values ?? {})).toEqual(["admin_note"]);
    expect(String(noteWrite.values?.admin_note)).toContain(text);
    expect(activatePaidOrder).not.toHaveBeenCalled();
  });

  test("우리 채널 키가 설정돼 있지 않으면 결제 완료여도 확정하지 않는다 — 다시 시도할 수 있는 실패", async () => {
    vi.stubEnv("NEXT_PUBLIC_PORTONE_CHANNEL_KEY", "");
    const calls = stubDb(order());
    stubLookup(found("PAID"));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toMatchObject({ ok: false, reason: "retry" });
    expect(writes(calls)).toEqual([]);
  });

  test("불일치 메모 기록에 실패하면 운영자가 확인한다고 하지 않고 다시 시도하게 한다", async () => {
    stubDb(order(), { noteError: { message: "db down" } });
    stubLookup(found("PAID", 1000));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toMatchObject({ ok: false, reason: "retry" });
    expect(!result.ok && result.message).toContain("새로고침");
    expect(!result.ok && result.message).not.toContain("운영자");
  });

  test("환불 메모 기록에 실패하면 환불해 드린다고 하지 않고 다시 시도하게 한다", async () => {
    stubDb(order({ status: "canceled" }), { noteError: { message: "db down" } });
    stubLookup(found("PAID"));

    const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

    expect(result).toMatchObject({ ok: false, reason: "retry" });
    expect(!result.ok && result.message).not.toContain("환불");
  });

  test.each<[string, OrderRow | null, PortOneLookup, string]>([
    ["주문 없음", null, { kind: "not_found" }, "not_found"],
    ["결제 없음", order(), { kind: "not_found" }, "not_paid"],
    ["결제창만 연 상태", order(), found("READY"), "not_paid"],
    ["조회 실패", order(), { kind: "error" }, "retry"],
    ["취소된 주문", order({ status: "canceled" }), { kind: "not_found" }, "closed"],
    ["취소된 주문에 결제", order({ status: "canceled" }), found("PAID"), "closed"],
  ])("실패 사유: %s", async (_label, row, lookup, reason) => {
    stubDb(row);
    stubLookup(lookup);

    expect(await confirmPaidTesterOrder({ orderId: ORDER_CODE })).toMatchObject({ ok: false, reason });
  });
});

describe("confirmPaidTesterOrder — 결제가 없거나 끝나지 않았을 때의 사유 (결제 전 확인이 쓴다)", () => {
  test.each<[string, PortOneLookup]>([
    ["결제 없음", { kind: "not_found" }],
    ["READY", found("READY")],
    ["FAILED", found("FAILED")],
  ])("%s 이면 다시 결제할 수 있다 (not_paid)", async (_label, lookup) => {
    stubDb(order());
    stubLookup(lookup);

    expect(await confirmPaidTesterOrder({ orderId: ORDER_CODE })).toMatchObject({ ok: false, reason: "not_paid" });
  });

  test.each(["PENDING", "PAY_PENDING", "VIRTUAL_ACCOUNT_ISSUED", "PARTIAL_CANCELLED", "CANCELLED", "SOMETHING_NEW"])(
    "%s 이면 다시 결제하게 두지 않고 확인 중이라고 알린다 (payment_unsettled) — 아무것도 쓰지 않는다",
    async (status) => {
      const calls = stubDb(order());
      stubLookup(found(status));

      const result = await confirmPaidTesterOrder({ orderId: ORDER_CODE });

      expect(result).toMatchObject({ ok: false, reason: "payment_unsettled" });
      expect(!result.ok && result.message).toContain("확인하고 있습니다");
      expect(!result.ok && result.message).toContain("문의");
      expect(writes(calls)).toEqual([]);
    },
  );
});
