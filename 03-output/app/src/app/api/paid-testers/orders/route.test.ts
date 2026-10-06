// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: 11, role: "admin", nickname: "구매자", email: "buyer@example.com" })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/paid-orders", () => ({ createCreditsPaidOrder: vi.fn() }));
vi.mock("@/lib/paid-seats", () => ({ isCreditsPaidOrder: vi.fn(async () => false) }));

import { isCreditsPaidOrder } from "@/lib/paid-seats";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

const EXISTING_CODE = "pt_0123456789abcdef0123456789abcdef";

type Call = { table: string; op: "select" | "insert"; filters: Record<string, unknown>; values?: Record<string, unknown> };

/** 매칭 중인 내 앱 한 건 + (있다면) 최근 미결제 주문 한 건이 있는 DB */
function stubDb(pendingOrder: { id: number; order_code: string } | null) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: {} };
    calls.push(call);
    const builder: Record<string, unknown> = {
      select: () => builder,
      in: () => builder,
      gte: () => builder,
      order: () => builder,
      limit: () => builder,
      insert(values: Record<string, unknown>) {
        call.op = "insert";
        call.values = values;
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters[column] = value;
        return builder;
      },
      maybeSingle: () =>
        Promise.resolve(
          table === "apps"
            ? {
                data: { id: 3, name: "가계부", owner_user_id: 11, status: "matching", store_invite_url: "https://play.google.com/x", web_invite_url: null },
                error: null,
              }
            : { data: pendingOrder, error: null },
        ),
      // await 로 끝나는 호출: 최근 결제 건수(count) 조회 또는 insert
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({ count: 0, error: null }).then(resolve),
    };
    return builder;
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return calls;
}

const order = () =>
  POST(
    new Request("http://localhost/api/paid-testers/orders", {
      method: "POST",
      body: JSON.stringify({ app_id: 3, tester_count: 3, pay_with: "card", agreed: true }),
    }),
  );
const inserts = (calls: Call[]) => calls.filter((c) => c.op === "insert");

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST orders — 카드 결제", () => {
  test("최근 30분 안에 같은 미결제 카드 주문이 있으면 새로 만들지 않고 그 주문 코드를 돌려준다", async () => {
    const calls = stubDb({ id: 7, order_code: EXISTING_CODE });

    const res = await order();

    expect(await res.json()).toEqual({ ok: true, order_code: EXISTING_CODE, paid: false });
    expect(inserts(calls)).toEqual([]);
    const reuseQuery = calls.find((c) => c.table === "paid_tester_orders" && c.filters.status === "pending");
    expect(reuseQuery?.filters).toEqual({
      buyer_user_id: 11,
      app_id: 3,
      tester_count: 3,
      status: "pending",
      seats_closed: false,
      fulfillment: "community",
    });
  });

  test("이어서 결제할 주문이 없으면 새 주문을 만든다", async () => {
    const calls = stubDb(null);

    const body = (await (await order()).json()) as { ok: boolean; order_code: string; paid: boolean };

    expect(body).toMatchObject({ ok: true, paid: false });
    expect(body.order_code).toMatch(/^pt_[0-9a-f]{32}$/);
    expect(inserts(calls)).toHaveLength(1);
    expect(inserts(calls)[0].values).toMatchObject({ order_code: body.order_code, tester_count: 3, amount_krw: 3300 });
  });

  test.each([true, null])("크레딧이 차감된 주문(또는 확인 불가: %j)은 잇지 않고 새 주문을 만든다", async (creditsPaid) => {
    const calls = stubDb({ id: 7, order_code: EXISTING_CODE });
    vi.mocked(isCreditsPaidOrder).mockResolvedValueOnce(creditsPaid);

    const body = (await (await order()).json()) as { order_code: string };

    expect(body.order_code).not.toBe(EXISTING_CODE);
    expect(inserts(calls)).toHaveLength(1);
  });
});
