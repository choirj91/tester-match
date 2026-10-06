"use client";

import { useEffect, useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";
import { normalizeKoreanMobile } from "@/lib/phone";

type Props = {
  storeId: string;
  channelKey: string;
  /** 주문 코드 — 포트원 결제 ID 로 그대로 쓴다 (서버가 이 값으로 결제를 조회한다) */
  orderCode: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
};

type Precheck =
  | { kind: "payable" | "paid" }
  | { kind: "closed" | "error"; message: string };

const PRECHECK_FAILED_MESSAGE = "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
const PHONE_INVALID_MESSAGE = "휴대폰 번호를 확인해주세요 (예: 010-1234-5678).";

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
 * 포트원 V2 결제창(KG이니시스 카드) 호출 버튼.
 * 이니시스는 구매자 이름·이메일·휴대폰 번호를 요구한다 — 휴대폰 번호는 여기서 입력받아 결제창에만
 * 넘기고 우리 서버로는 보내지 않는다 (ADR-0017).
 * PC 는 프로미스로 결과가 돌아오고, 모바일은 redirectUrl 로 이동한다 — 둘 다 같은 성공 화면에서
 * 서버가 포트원에 결제를 조회해 확정한다. 브라우저가 받은 결과는 화면 이동에만 쓴다.
 */
export function PayButton(props: Props) {
  const [phone, setPhone] = useState("");
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

  const phoneDigits = normalizeKoreanMobile(phone);

  async function handlePay() {
    if (paying || closed) return;
    if (!phoneDigits) {
      setError(PHONE_INVALID_MESSAGE);
      return;
    }
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
        customer: {
          fullName: props.customerName,
          email: props.customerEmail,
          phoneNumber: phoneDigits,
        },
        redirectUrl: successUrl,
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
      <label htmlFor="pay-phone" className="block text-sm font-semibold text-neutral-900">
        휴대폰 번호
      </label>
      <input
        id="pay-phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-1234-5678"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={13}
        disabled={paying || closed}
        className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
      />
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
        결제대행사(KG이니시스) 결제창에 구매자 정보로 전달하기 위해서만 쓰이며, Tester Match 서버에는
        저장되지 않습니다.
      </p>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={paying || closed || !phoneDigits}
        className="bg-trust-600 hover:bg-trust-700 mt-4 w-full rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {paying ? "결제 진행 중…" : `${props.amount.toLocaleString("ko-KR")}원 결제하기`}
      </button>
    </div>
  );
}
