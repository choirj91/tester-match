"use client";

import { useEffect, useRef, useState } from "react";

/** 토스 결제위젯 v2 — 우리가 쓰는 표면만 타입으로 고정 */
type TossWidgets = {
  setAmount(amount: { currency: "KRW"; value: number }): Promise<void>;
  renderPaymentMethods(options: { selector: string; variantKey?: string }): Promise<unknown>;
  renderAgreement(options: { selector: string; variantKey?: string }): Promise<unknown>;
  requestPayment(options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    customerName?: string;
  }): Promise<void>;
};

type TossPaymentsFn = (clientKey: string) => {
  widgets(options: { customerKey: string }): TossWidgets;
};

declare global {
  interface Window {
    TossPayments?: TossPaymentsFn;
  }
}

const SDK_SRC = "https://js.tosspayments.com/v2/standard";

type Props = {
  clientKey: string;
  customerKey: string;
  orderCode: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
};

export function CheckoutWidget(props: Props) {
  const widgetsRef = useRef<TossWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function init() {
      try {
        await loadSdk();
        if (disposed || !window.TossPayments) return;
        const widgets = window.TossPayments(props.clientKey).widgets({
          customerKey: props.customerKey,
        });
        await widgets.setAmount({ currency: "KRW", value: props.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        if (disposed) return;
        widgetsRef.current = widgets;
        setReady(true);
      } catch (err) {
        console.error("[checkout] widget init failed", err);
        if (!disposed) setError("결제위젯을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      }
    }

    void init();
    return () => {
      disposed = true;
    };
    // props 는 서버에서 고정되어 내려온다 — 마운트 1회 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePay() {
    const widgets = widgetsRef.current;
    if (!widgets) return;
    setPaying(true);
    setError(null);
    try {
      await widgets.requestPayment({
        orderId: props.orderCode,
        orderName: props.orderName,
        successUrl: `${window.location.origin}/paid-testers/success`,
        failUrl: `${window.location.origin}/paid-testers/fail`,
        customerEmail: props.customerEmail,
        customerName: props.customerName,
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우도 여기로 온다
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "결제가 진행되지 않았습니다.";
      setError(message);
      setPaying(false);
    }
  }

  return (
    <div className="mt-6">
      <div id="payment-method" />
      <div id="agreement" />
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || paying}
        className="mt-4 w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {!ready ? "결제위젯 불러오는 중…" : paying ? "결제 진행 중…" : `${props.amount.toLocaleString("ko-KR")}원 결제하기`}
      </button>
    </div>
  );
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK load error")));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK load error"));
    document.head.appendChild(script);
  });
}
