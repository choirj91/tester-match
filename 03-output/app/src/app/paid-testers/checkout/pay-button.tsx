"use client";

import { useEffect, useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";

/** 결제창에 표시되는 상호 — KCP 모바일·카드사 직접 호출에서 필수 (다른 PG 는 무시) */
const KCP_SITE_NAME = "Tester Match";

type Props = {
  storeId: string;
  channelKey: string;
  /** 주문 코드 — 포트원 결제 ID 로 그대로 쓴다 (서버가 이 값으로 결제를 조회한다) */
  orderCode: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  /** PG 에 넘기는 우리 쪽 회원 식별자 (KCP shop_user_id) */
  customerId: string;
};

type Precheck =
  | { kind: "payable" | "paid" }
  | { kind: "closed" | "error"; message: string };

const PRECHECK_FAILED_MESSAGE = "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";

/**
 * 결제창을 열기 전 서버 확인 — 이미 결제된 주문에 결제창을 다시 열거나 취소된 주문에 결제하는 일을 막는다.
 * 확인에 실패하면(error) 결제창을 열지 않는다.
 */
async function precheckOrder(orderCode: string): Promise<Precheck> {
  try {
    const res = await fetch(`/api/paid-testers/orders/${encodeURIComponent(orderCode)}/precheck`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as { state?: string; message?: string };
    if (res.ok && (data.state === "payable" || data.state === "paid")) return { kind: data.state };
    if (res.ok && data.state === "closed") {
      return { kind: "closed", message: data.message ?? "결제할 수 없는 주문입니다." };
    }
    return { kind: "error", message: data.message ?? PRECHECK_FAILED_MESSAGE };
  } catch {
    return { kind: "error", message: PRECHECK_FAILED_MESSAGE };
  }
}

/**
 * 포트원 V2 결제창(NHN KCP 카드) 호출 버튼.
 * PC 는 프로미스로 결과가 돌아오고, 모바일은 redirectUrl 로 이동한다 — 둘 다 같은 성공 화면에서
 * 서버가 포트원에 결제를 조회해 확정한다. 브라우저가 받은 결과는 화면 이동에만 쓴다.
 */
export function PayButton(props: Props) {
  const [paying, setPaying] = useState(false);
  /** 결제할 수 없는 주문으로 확인됨 — 버튼을 다시 열지 않는다 */
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 모바일에서 결제창(리디렉션)으로 갔다가 뒤로 오면 브라우저가 "결제 진행 중" 화면을 그대로 되살린다 (bfcache)
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPaying(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function handlePay() {
    if (paying || closed) return;
    setPaying(true);
    setError(null);
    const successUrl = `${window.location.origin}/paid-testers/success?orderId=${encodeURIComponent(props.orderCode)}`;

    const precheck = await precheckOrder(props.orderCode);
    if (precheck.kind === "closed" || precheck.kind === "error") {
      setError(precheck.message);
      setClosed(precheck.kind === "closed");
      setPaying(false);
      return;
    }
    if (precheck.kind === "paid") {
      window.location.assign(successUrl);
      return;
    }

    try {
      const response = await PortOne.requestPayment({
        storeId: props.storeId,
        channelKey: props.channelKey,
        paymentId: props.orderCode,
        orderName: props.orderName,
        totalAmount: props.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: { fullName: props.customerName, email: props.customerEmail },
        redirectUrl: successUrl,
        bypass: { kcp_v2: { site_name: KCP_SITE_NAME, shop_user_id: props.customerId } },
      });
      // 리디렉션 방식(모바일)은 응답 없이 끝난다 — 브라우저가 PG·성공 화면으로 이동 중이니 가로채지 않는다
      if (!response) return;
      if (response.code !== undefined) {
        // 결제 실패 또는 사용자가 결제창을 닫음
        setError(response.message ?? "결제가 진행되지 않았습니다.");
        setPaying(false);
        return;
      }
      window.location.assign(successUrl);
    } catch (err) {
      console.error("[checkout] requestPayment failed", err);
      setError("결제창을 열지 못했습니다. 새로고침 후 다시 시도해주세요.");
      setPaying(false);
    }
  }

  return (
    <div className="mt-6">
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={paying || closed}
        className="bg-trust-600 hover:bg-trust-700 mt-4 w-full rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {paying ? "결제 진행 중…" : `${props.amount.toLocaleString("ko-KR")}원 결제하기`}
      </button>
    </div>
  );
}
