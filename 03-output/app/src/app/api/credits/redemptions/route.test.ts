// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: 11, nickname: "테스터", email: "tester@example.com" })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/email", () => ({
  getAdminNotifyEmail: vi.fn(() => "ops@example.com"),
  sendEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/wait-until", () => ({ runAfterResponse: vi.fn(async () => undefined) }));

import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

type RpcResult = { data: unknown; error: { code?: string; message?: string; details?: string } | null };

/** redemption_create RPC 하나만 있는 DB — 신청·차감·검사는 모두 DB 함수 안에서 한다 */
function stubDb(result: RpcResult = { data: "ok:99", error: null }) {
  const rpc = vi.fn(async () => result);
  const from = vi.fn(() => {
    throw new Error("route must not touch tables directly");
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc, from } as never);
  return rpc;
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
  vi.restoreAllMocks();
});

describe("POST /api/credits/redemptions — 입력 검사 (DB 호출 전)", () => {
  test("로그인하지 않으면 401", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const rpc = stubDb();

    expect((await redeem({ item_code: "npay_5000", quantity: 1 })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("카탈로그에 없는 상품은 400", async () => {
    const rpc = stubDb();

    const res = await redeem({ item_code: "cash_50000", quantity: 1, amount: 50000 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, message: "교환할 수 없는 상품입니다. 목록에서 다시 골라주세요." });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("합계가 50,000 크레딧을 넘으면 400", async () => {
    const rpc = stubDb();

    const res = await redeem({ item_code: "npay_10000", quantity: 6 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, message: "한 번에 50,000 크레딧까지 교환할 수 있습니다." });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("예전 금액 직접 선택 요청(kind·amount)은 400", async () => {
    const rpc = stubDb();

    expect((await redeem({ kind: "gifticon", amount: 5000 })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/credits/redemptions — redemption_create", () => {
  test("클라이언트가 보낸 금액·종류는 무시하고 상품 크레딧 × 수량을 넘긴다", async () => {
    const rpc = stubDb();

    const res = await redeem({ item_code: "starbucks_americano_t", quantity: 2, amount: 1, kind: "naver_points" });

    expect(await res.json()).toEqual({ ok: true, id: 99 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("redemption_create", expect.objectContaining({ p_amount: 9400, p_kind: "gifticon" }));
  });

  test("성공 — 상품 코드·수량·차감액·연락처 해시·원장 설명을 넘기고 관리자에게 알린다", async () => {
    const rpc = stubDb({ data: "ok:7", error: null });

    const res = await redeem({ item_code: "npay_5000", quantity: 3, note: "  빠른 처리 부탁  " });

    expect(await res.json()).toEqual({ ok: true, id: 7 });
    expect(rpc).toHaveBeenCalledWith("redemption_create", {
      p_user: 11,
      p_item_code: "npay_5000",
      p_quantity: 3,
      p_amount: 15000,
      p_kind: "naver_points",
      p_contact: "01012345678",
      p_contact_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_note: "빠른 처리 부탁",
      p_description: "보상 교환 신청 (네이버페이 포인트 5,000원권 ×3)",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ops@example.com", subject: expect.stringContaining("네이버페이 포인트 5,000원권 ×3") }),
    );
  });

  test.each([
    ["pending", 409, "이미 처리 대기 중인 교환 신청이 있습니다."],
    ["not_redeemable", 409, "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)"],
    ["contact_in_use", 409, "다른 계정에서 이미 사용된 연락처입니다. 문의가 필요하면 운영팀에 메일 주세요."],
    ["invalid", 400, "신청 내용을 다시 확인해주세요."],
  ])("함수가 '%s' 를 돌려주면 %i", async (code, status, message) => {
    stubDb({ data: code, error: null });

    const res = await redeem({ item_code: "mega_americano_hot", quantity: 1 });

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, message });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test.each([
    [{ code: "P0001", message: "NOT_REDEEMABLE" }, 409, "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)"],
    [{ code: "23505", message: "duplicate key value" }, 409, "이미 처리 대기 중인 교환 신청이 있습니다."],
    [{ code: "57014", message: "canceling statement due to statement timeout" }, 500, "신청에 실패했습니다."],
  ])("RPC 오류 %j → %i, 로그에는 코드·문구만", async (error, status, message) => {
    stubDb({ data: null, error: { ...error, details: "Key (contact)=(01012345678)" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await redeem({ item_code: "mega_americano_hot", quantity: 1 });

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, message });
    expect(logged).toHaveBeenCalledWith("[redemptions/POST] redemption_create failed", {
      code: error.code,
      message: error.message,
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("01012345678");
  });

  test("알 수 없는 결과는 500", async () => {
    stubDb({ data: "granted", error: null });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await redeem({ item_code: "npay_5000", quantity: 1 });

    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
