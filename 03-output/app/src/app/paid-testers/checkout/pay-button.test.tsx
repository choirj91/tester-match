import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@portone/browser-sdk/v2", () => ({ requestPayment: vi.fn() }));

import * as PortOne from "@portone/browser-sdk/v2";
import { PayButton } from "./pay-button";

const ORDER_CODE = "pt_0123456789abcdef0123456789abcdef";
const SUCCESS_URL = `https://tm.example/paid-testers/success?orderId=${ORDER_CODE}`;

const props = {
  storeId: "store-test",
  channelKey: "channel-key-test",
  orderCode: ORDER_CODE,
  orderName: "가계부 테스터 3명 (14일)",
  amount: 3000,
  customerEmail: "buyer@example.com",
  customerName: "구매자",
  customerId: "tm_user_11",
};

const assign = vi.fn();
const fetchMock = vi.fn();
const requestPayment = vi.mocked(PortOne.requestPayment);
const payButton = () => screen.getByRole("button");
const response = (extra: Record<string, string> = {}) => ({
  transactionType: "PAYMENT" as const,
  txId: "tx_1",
  paymentId: ORDER_CODE,
  ...extra,
});
/** 결제 전 확인(precheck) 응답 */
const stubPrecheck = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubGlobal("location", { origin: "https://tm.example", assign });
  vi.stubGlobal("fetch", fetchMock);
  stubPrecheck({ state: "payable" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("PayButton — 결제창", () => {
  test("주문 코드를 결제 ID 로 삼아 KCP 카드 결제창을 요청한다", async () => {
    requestPayment.mockResolvedValue(response());
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
    expect(requestPayment).toHaveBeenCalledWith({
      storeId: "store-test",
      channelKey: "channel-key-test",
      paymentId: ORDER_CODE,
      orderName: "가계부 테스터 3명 (14일)",
      totalAmount: 3000,
      currency: "CURRENCY_KRW",
      payMethod: "CARD",
      customer: { fullName: "구매자", email: "buyer@example.com" },
      redirectUrl: SUCCESS_URL,
      bypass: { kcp_v2: { site_name: "Tester Match", shop_user_id: "tm_user_11" } },
    });
  });

  test("PC: 결제창이 오류 없이 닫히면 성공 화면으로 이동해 서버가 결제를 확인하게 한다", async () => {
    requestPayment.mockResolvedValue(response());
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    await waitFor(() => expect(assign).toHaveBeenCalledWith(SUCCESS_URL));
  });

  test("PC: 실패하거나 창을 닫으면(code) 메시지를 보여주고 다시 결제할 수 있게 한다", async () => {
    requestPayment.mockResolvedValue(
      response({ code: "FAILURE_TYPE_PG", message: "사용자가 결제를 취소하였습니다" }),
    );
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    expect(await screen.findByText("사용자가 결제를 취소하였습니다")).toBeInTheDocument();
    expect(payButton()).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });

  test("결제 모듈을 불러오지 못하면(예외) 안내하고 다시 결제할 수 있게 한다", async () => {
    requestPayment.mockRejectedValue(new Error("[PortOne] Failed to load window.PortOne"));
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    expect(await screen.findByText(/결제창을 열지 못했습니다/)).toBeInTheDocument();
    expect(payButton()).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });

  test("모바일: 응답 없이 끝나면(리디렉션 진행 중) 이동을 가로채지 않는다", async () => {
    requestPayment.mockResolvedValue(undefined);
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
    expect(assign).not.toHaveBeenCalled();
    expect(payButton()).toBeDisabled();
  });

  test("결제 진행 중에는 버튼이 잠겨 결제창을 두 번 열지 않는다", async () => {
    requestPayment.mockReturnValue(new Promise(() => {}));
    render(<PayButton {...props} />);

    fireEvent.click(payButton());
    await waitFor(() => expect(payButton()).toBeDisabled());
    fireEvent.click(payButton());

    await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("모바일에서 뒤로 돌아와 화면이 되살아나면(bfcache) 버튼을 다시 연다", async () => {
    requestPayment.mockReturnValue(new Promise(() => {}));
    render(<PayButton {...props} />);
    fireEvent.click(payButton());
    await waitFor(() => expect(payButton()).toBeDisabled());

    fireEvent(window, Object.assign(new Event("pageshow"), { persisted: false }));
    expect(payButton()).toBeDisabled();
    fireEvent(window, Object.assign(new Event("pageshow"), { persisted: true }));

    await waitFor(() => expect(payButton()).toBeEnabled());
  });
});

describe("PayButton — 결제 전 확인(precheck)", () => {
  test("결제창을 열기 전에 서버에 주문 상태를 확인한다", async () => {
    requestPayment.mockResolvedValue(response());
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(`/api/paid-testers/orders/${ORDER_CODE}/precheck`, { method: "POST" });
  });

  test("이미 결제된 주문이면 결제창을 열지 않고 성공 화면으로 간다", async () => {
    stubPrecheck({ state: "paid" });
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    await waitFor(() => expect(assign).toHaveBeenCalledWith(SUCCESS_URL));
    expect(requestPayment).not.toHaveBeenCalled();
  });

  test("결제할 수 없는 주문이면 안내하고 버튼을 잠근 채로 둔다", async () => {
    stubPrecheck({ state: "closed", message: "이미 취소되었거나 환불된 주문입니다." });
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    expect(await screen.findByText("이미 취소되었거나 환불된 주문입니다.")).toBeInTheDocument();
    expect(payButton()).toBeDisabled();
    expect(requestPayment).not.toHaveBeenCalled();
  });

  test.each<[string, () => void, RegExp]>([
    ["서버가 확인에 실패(500)", () => stubPrecheck({ message: "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }, 500), /확인하지 못했습니다/],
    ["통신 오류", () => fetchMock.mockRejectedValue(new Error("offline")), /확인하지 못했습니다/],
    ["알 수 없는 응답", () => stubPrecheck({ state: "weird" }), /확인하지 못했습니다/],
  ])("%s 이면 결제창을 열지 않고 안내한 뒤 다시 시도할 수 있게 한다", async (_label, arrange, text) => {
    arrange();
    render(<PayButton {...props} />);

    fireEvent.click(payButton());

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(payButton()).toBeEnabled();
    expect(requestPayment).not.toHaveBeenCalled();
  });
});
