// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: 11, nickname: "테스터", email: "tester@example.com" })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/credits")>()),
  getRedeemable: vi.fn(async () => 50000),
  appendLedger: vi.fn(async () => ({ ok: true, id: 501, duplicate: false })),
}));
vi.mock("@/lib/email", () => ({
  getAdminNotifyEmail: vi.fn(() => "ops@example.com"),
  sendEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/wait-until", () => ({ runAfterResponse: vi.fn(async () => undefined) }));

import { getCurrentUser } from "@/lib/auth";
import { appendLedger, getRedeemable } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

type Insert = { table: string; values: Record<string, unknown> };

/** 연락처 중복 조회(count)·처리 대기 조회(count)와 신청 insert 만 있는 DB */
function stubDb({
  usedElsewhere = 0,
  pending = 0,
  insertError = null,
}: {
  usedElsewhere?: number;
  pending?: number;
  insertError?: { code: string; message: string } | null;
} = {}) {
  const inserts: Insert[] = [];
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      neq: () => builder,
      insert(values: Record<string, unknown>) {
        inserts.push({ table, values });
        return builder;
      },
      single: () => Promise.resolve(insertError ? { data: null, error: insertError } : { data: { id: 99 }, error: null }),
      // await 로 끝나는 호출: 처리 대기(status=requested) 건수 또는 연락처 중복 건수
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ count: filters.status === "requested" ? pending : usedElsewhere, error: null }).then(resolve),
    };
    return builder;
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return inserts;
}

const redeem = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost/api/credits/redemptions", {
      method: "POST",
      body: JSON.stringify({ contact: "010-1234-5678", ...body }),
    }),
  );

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/credits/redemptions — 상품 교환 신청", () => {
  test("로그인하지 않으면 401", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const inserts = stubDb();

    const res = await redeem({ item_code: "npay_5000", quantity: 1 });

    expect(res.status).toBe(401);
    expect(inserts).toEqual([]);
  });

  test("카탈로그에 없는 상품은 400 — 크레딧을 건드리지 않는다", async () => {
    const inserts = stubDb();

    const res = await redeem({ item_code: "cash_50000", quantity: 1, amount: 50000 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, message: "교환할 수 없는 상품입니다. 목록에서 다시 골라주세요." });
    expect(appendLedger).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  test("클라이언트가 보낸 금액·종류는 무시하고 상품 크레딧 × 수량을 차감한다", async () => {
    const inserts = stubDb();

    const res = await redeem({ item_code: "starbucks_americano_t", quantity: 2, amount: 1, kind: "naver_points" });

    expect(await res.json()).toEqual({ ok: true, id: 99 });
    expect(appendLedger).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: -9400 }));
    expect(inserts[0].values).toMatchObject({ amount: 9400, kind: "gifticon", item_code: "starbucks_americano_t", quantity: 2 });
  });

  test("합계가 50,000 크레딧을 넘으면 400", async () => {
    const inserts = stubDb();

    const res = await redeem({ item_code: "npay_10000", quantity: 6 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, message: "한 번에 50,000 크레딧까지 교환할 수 있습니다." });
    expect(appendLedger).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  test("교환 가능 크레딧이 모자라면 409 — 유료 시트 적립분만 교환된다고 알린다", async () => {
    const inserts = stubDb();
    vi.mocked(getRedeemable).mockResolvedValueOnce(4000);

    const res = await redeem({ item_code: "starbucks_americano_t", quantity: 1 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      message: "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)",
    });
    expect(appendLedger).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  test("다른 계정이 쓴 휴대폰 번호면 409", async () => {
    const inserts = stubDb({ usedElsewhere: 1 });

    const res = await redeem({ item_code: "npay_5000", quantity: 1 });

    expect(res.status).toBe(409);
    expect(appendLedger).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  test("처리 대기 신청이 있으면 차감하지 않고 409", async () => {
    const inserts = stubDb({ pending: 1 });

    const res = await redeem({ item_code: "npay_5000", quantity: 1 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, message: "이미 처리 대기 중인 교환 신청이 있습니다." });
    expect(getRedeemable).not.toHaveBeenCalled();
    expect(appendLedger).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  test("성공 — 교환 가능액 한도로 선차감하고 상품 코드·수량·차감액을 저장한다", async () => {
    const inserts = stubDb();

    const res = await redeem({ item_code: "npay_5000", quantity: 3, note: "  빠른 처리 부탁  " });

    expect(await res.json()).toEqual({ ok: true, id: 99 });
    expect(appendLedger).toHaveBeenCalledTimes(1);
    expect(appendLedger).toHaveBeenCalledWith(expect.anything(), {
      userId: 11,
      amount: -15000,
      type: "spend",
      refType: "redemption",
      description: "보상 교환 신청 (네이버페이 포인트 5,000원권 ×3)",
      capRedeemable: true,
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      table: "credit_redemptions",
      values: {
        user_id: 11,
        kind: "naver_points",
        item_code: "npay_5000",
        quantity: 3,
        amount: 15000,
        contact: "01012345678",
        note: "빠른 처리 부탁",
        ledger_id: 501,
      },
    });
    expect(inserts[0].values.contact_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("동시 신청으로 유니크 위반이 나면 차감을 되돌리고 409", async () => {
    stubDb({ insertError: { code: "23505", message: "duplicate" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await redeem({ item_code: "mega_americano_hot", quantity: 1 });

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, message: "이미 처리 대기 중인 교환 신청이 있습니다." });
    expect(appendLedger).toHaveBeenCalledTimes(2);
    expect(appendLedger).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 1700, type: "refund", refType: "redemption" }),
    );
  });
});
