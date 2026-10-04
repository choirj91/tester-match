import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { lookupPortOnePayment } from "./portone";

const PAYMENT_ID = "pt_0123456789abcdef0123456789abcdef";

const paidBody = {
  status: "PAID",
  id: PAYMENT_ID,
  transactionId: "tx_1",
  amount: { total: 3000, paid: 3000 },
  currency: "KRW",
  channel: { type: "LIVE", id: "channel-id-1", key: "channel-key-live", name: "KCP", pgProvider: "KCP_V2" },
  paidAt: "2026-10-05T01:00:00Z",
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("PORTONE_API_SECRET", "secret_for_test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("lookupPortOnePayment", () => {
  test("결제가 있으면 우리가 쓰는 필드만 골라 돌려준다", async () => {
    const fetchMock = stubFetch(200, paidBody);

    const result = await lookupPortOnePayment(PAYMENT_ID);

    expect(result).toEqual({
      kind: "found",
      payment: {
        id: PAYMENT_ID,
        status: "PAID",
        totalAmount: 3000,
        paidAmount: 3000,
        currency: "KRW",
        channelKey: "channel-key-live",
        channelType: "LIVE",
        transactionId: "tx_1",
        paidAt: "2026-10-05T01:00:00Z",
      },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.portone.io/payments/${PAYMENT_ID}`);
    expect(init.headers).toEqual({ Authorization: "PortOne secret_for_test" });
    // 응답이 없으면 8초 뒤 끊는다 — 끊기면 fetch 가 예외를 던져 조회 실패가 된다
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("결제 ID 는 URL 인코딩해서 보낸다", async () => {
    const fetchMock = stubFetch(404, { type: "PAYMENT_NOT_FOUND", message: "x" });

    await lookupPortOnePayment("a/b?c");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.portone.io/payments/a%2Fb%3Fc");
  });

  test("결제창만 열고 끝난 결제(READY)는 거래 ID·채널·승인 시각 없이도 found 다", async () => {
    stubFetch(200, { status: "READY", id: PAYMENT_ID, amount: { total: 3000 } });

    expect(await lookupPortOnePayment(PAYMENT_ID)).toEqual({
      kind: "found",
      payment: { id: PAYMENT_ID, status: "READY", totalAmount: 3000 },
    });
  });

  test("404 PAYMENT_NOT_FOUND 만 결제 없음으로 읽는다", async () => {
    stubFetch(404, { type: "PAYMENT_NOT_FOUND", message: "결제 건을 찾을 수 없습니다." });

    expect(await lookupPortOnePayment(PAYMENT_ID)).toEqual({ kind: "not_found" });
  });

  test("API 시크릿이 없으면 호출하지 않고 조회 실패로 돌려준다", async () => {
    vi.stubEnv("PORTONE_API_SECRET", "");
    const fetchMock = stubFetch(200, paidBody);

    expect(await lookupPortOnePayment(PAYMENT_ID)).toEqual({ kind: "error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("통신 예외는 조회 실패다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await lookupPortOnePayment(PAYMENT_ID)).toEqual({ kind: "error" });
  });

  test.each([
    ["인증 실패", 401, { type: "UNAUTHORIZED" }],
    ["권한 없음", 403, { type: "FORBIDDEN" }],
    ["서버 오류", 500, { message: "oops" }],
    ["PAYMENT_NOT_FOUND 가 아닌 404", 404, { type: "SOMETHING_ELSE" }],
    ["본문이 JSON 이 아닌 404", 404, "<html>not found</html>"],
  ])("%s 는 결제 없음이 아니라 조회 실패다", async (_label, status, body) => {
    stubFetch(status, body);

    expect(await lookupPortOnePayment(PAYMENT_ID)).toEqual({ kind: "error" });
  });

  test.each([
    ["JSON 이 아님", "not json"],
    ["상태 없음", { id: PAYMENT_ID, amount: { total: 3000 } }],
    ["금액 없음", { id: PAYMENT_ID, status: "PAID" }],
    ["금액이 숫자가 아님", { id: PAYMENT_ID, status: "PAID", amount: { total: "3000" } }],
    ["다른 결제 ID", { ...paidBody, id: "pt_other" }],
    ["결제 완료인데 채널 없음", { ...paidBody, channel: undefined }],
    ["결제 완료인데 통화 없음", { ...paidBody, currency: undefined }],
    ["채널 키가 문자열이 아님", { ...paidBody, channel: { type: "LIVE", key: 1 } }],
    ["채널 유형이 없음", { ...paidBody, channel: { key: "channel-key-live" } }],
    ["통화가 문자열이 아님", { ...paidBody, currency: 410 }],
    ["실결제액이 숫자가 아님", { ...paidBody, amount: { total: 3000, paid: "3000" } }],
  ])("200 이어도 본문이 깨졌으면(%s) 조회 실패다", async (_label, body) => {
    stubFetch(200, body);

    expect(await lookupPortOnePayment(PAYMENT_ID)).toEqual({ kind: "error" });
  });
});
