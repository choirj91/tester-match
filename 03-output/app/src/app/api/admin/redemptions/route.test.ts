// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/admin", () => ({ getAdminUser: vi.fn(async () => ({ id: 1, role: "admin" })) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn(async () => undefined) }));

import { getAdminUser } from "@/lib/admin";
import { createNotification } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "./route";

type Row = {
  id: number;
  user_id: number;
  amount: number;
  contact: string;
  status: string;
  kind: string;
  item_code: string | null;
  quantity: number | null;
};

type Update = { values: Record<string, unknown>; filters: Record<string, unknown> };

/**
 * 신청 한 건이 있는 DB. redemption_reject 는 SQL 과 같은 규칙으로 흉내 낸다:
 * 'requested' 일 때만 거절·마스킹·복구 1회, 아니면 'already'.
 */
function stubDb(initial: Row, opts: { rpcError?: { code: string; message: string } } = {}) {
  const row = { ...initial };
  const refunds: number[] = [];
  const updates: Update[] = [];

  const rpc = vi.fn(async (_name: string, args: { p_id: number }) => {
    if (opts.rpcError) return { data: null, error: opts.rpcError };
    if (args.p_id !== row.id || row.status !== "requested") return { data: "already", error: null };
    row.status = "rejected";
    row.contact = `${"*".repeat(row.contact.length - 4)}${row.contact.slice(-4)}`;
    refunds.push(row.amount);
    return { data: "rejected", error: null };
  });

  const from = vi.fn(() => {
    const filters: Record<string, unknown> = {};
    let values: Record<string, unknown> | null = null;
    const matches = () => filters.id === row.id && (filters.status === undefined || filters.status === row.status);
    const builder: Record<string, unknown> = {
      update(v: Record<string, unknown>) {
        values = v;
        return builder;
      },
      select: () => builder,
      eq(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: matches() ? { ...row } : null, error: null }),
      then(resolve: (r: unknown) => unknown) {
        if (values) {
          updates.push({ values, filters: { ...filters } });
          if (!matches()) return Promise.resolve({ data: [], error: null }).then(resolve);
          Object.assign(row, values);
          return Promise.resolve({ data: [{ ...row }], error: null }).then(resolve);
        }
        return Promise.resolve({ data: [{ ...row }], error: null }).then(resolve);
      },
    };
    return builder;
  });

  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc, from } as never);
  return { row, refunds, updates, rpc };
}

const REQUESTED: Row = {
  id: 8,
  user_id: 11,
  amount: 9400,
  contact: "01012345678",
  status: "requested",
  kind: "gifticon",
  item_code: "starbucks_americano_t",
  quantity: 2,
};

const patch = (body: Record<string, unknown>) =>
  PATCH(new Request("http://localhost/api/admin/redemptions", { method: "PATCH", body: JSON.stringify(body) }));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("PATCH /api/admin/redemptions", () => {
  test("관리자가 아니면 403", async () => {
    vi.mocked(getAdminUser).mockResolvedValueOnce(null);
    const { rpc } = stubDb(REQUESTED);

    expect((await patch({ id: 8, action: "reject" })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("발송 완료는 발송 내역 5자 이상이 필요하다", async () => {
    const { updates } = stubDb(REQUESTED);

    expect((await patch({ id: 8, action: "done", admin_note: "짧음" })).status).toBe(400);
    expect(updates).toEqual([]);
  });

  test("발송 완료 — 상태 조건부 갱신, 연락처 마스킹, 상품 이름으로 알림", async () => {
    const { row, updates, rpc } = stubDb(REQUESTED);

    const res = await patch({ id: 8, action: "done", admin_note: "스타벅스 2잔 주문 1234" });

    expect(await res.json()).toEqual({ ok: true });
    expect(updates[0].filters).toEqual({ id: 8, status: "requested" });
    expect(row.status).toBe("done");
    expect(row.contact).toBe("*******5678");
    expect(rpc).not.toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 11,
        title: "보상 교환 상품을 보냈습니다",
        body: expect.stringContaining("스타벅스 카페 아메리카노 T ×2(9,400 크레딧)"),
      }),
    );
  });

  test("발송 완료를 다시 누르면 409 — 알림 없음", async () => {
    stubDb(REQUESTED);
    await patch({ id: 8, action: "done", admin_note: "스타벅스 2잔 주문 1234" });
    vi.mocked(createNotification).mockClear();

    const res = await patch({ id: 8, action: "done", admin_note: "스타벅스 2잔 주문 1234" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, message: "이미 처리된 신청입니다." });
    expect(createNotification).not.toHaveBeenCalled();
  });

  test("거절 — DB 함수 한 번으로 거절·마스킹·복구, 라우트는 원장을 직접 쓰지 않는다", async () => {
    const { row, refunds, updates, rpc } = stubDb(REQUESTED);

    const res = await patch({ id: 8, action: "reject", admin_note: "번호 확인 불가" });

    expect(await res.json()).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("redemption_reject", { p_id: 8, p_admin: 1, p_note: "번호 확인 불가" });
    expect(refunds).toEqual([9400]);
    expect(row.contact).toBe("*******5678");
    expect(updates).toEqual([]);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "보상 교환 신청이 거절되었습니다",
        body: "스타벅스 카페 아메리카노 T ×2 신청의 9,400 크레딧을 되돌렸습니다. 사유: 번호 확인 불가",
      }),
    );
  });

  test("거절을 다시 누르면 409 — 복구는 정확히 한 번", async () => {
    const { refunds } = stubDb(REQUESTED);

    const first = await patch({ id: 8, action: "reject" });
    const second = await patch({ id: 8, action: "reject" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: false, message: "이미 처리된 신청입니다." });
    expect(refunds).toEqual([9400]);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  test("발송 완료된 신청은 거절할 수 없다 (409, 복구 없음)", async () => {
    const { refunds } = stubDb({ ...REQUESTED, status: "done" });

    expect((await patch({ id: 8, action: "reject" })).status).toBe(409);
    expect(refunds).toEqual([]);
  });

  test("거절 RPC 오류는 500 — 로그에는 코드·문구만, 알림 없음", async () => {
    stubDb(REQUESTED, { rpcError: { code: "40P01", message: "deadlock detected" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await patch({ id: 8, action: "reject" });

    expect(res.status).toBe(500);
    expect(logged).toHaveBeenCalledWith("[admin/redemptions] redemption_reject failed", {
      code: "40P01",
      message: "deadlock detected",
    });
    expect(createNotification).not.toHaveBeenCalled();
  });

  test("이전 신청(상품 코드 없음)은 종류 이름으로 알린다", async () => {
    stubDb({ ...REQUESTED, kind: "naver_points", item_code: null, quantity: null, amount: 10000 });

    await patch({ id: 8, action: "reject" });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: "네이버페이 포인트 신청의 10,000 크레딧을 되돌렸습니다." }),
    );
  });
});
