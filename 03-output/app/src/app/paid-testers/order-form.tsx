"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAID_TESTER_MAX_COUNT,
  PAID_TESTER_MIN_COUNT,
  paidTesterAmountKrw,
} from "@/lib/paid-testers";

type Props = {
  apps: Array<{ id: number; name: string }>;
  /** 보유 크레딧 — 결제 금액 이상이면 크레딧 결제 선택지 노출 */
  balance: number;
};

type PayWith = "toss" | "credits";

export function OrderForm({ apps, balance }: Props) {
  const router = useRouter();
  const [appId, setAppId] = useState<number>(apps[0]?.id ?? 0);
  const [count, setCount] = useState<number>(PAID_TESTER_MIN_COUNT);
  const [payWith, setPayWith] = useState<PayWith>("toss");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = paidTesterAmountKrw(count);
  const canUseCredits = balance >= amount;
  const effectivePayWith: PayWith = canUseCredits ? payWith : "toss";

  const counts = Array.from(
    { length: PAID_TESTER_MAX_COUNT - PAID_TESTER_MIN_COUNT + 1 },
    (_, i) => PAID_TESTER_MIN_COUNT + i,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/paid-testers/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, tester_count: count, pay_with: effectivePayWith }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order_code?: string;
        paid?: boolean;
        message?: string;
      };
      if (!data.ok || !data.order_code) {
        setError(data.message ?? "주문 생성에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      router.push(
        data.paid
          ? `/paid-testers/success?orderId=${data.order_code}&credits=1`
          : `/paid-testers/checkout?order=${data.order_code}`,
      );
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-5 rounded-2xl border border-neutral-200 bg-white p-6"
    >
      <div>
        <label htmlFor="pt-app" className="block text-sm font-semibold text-neutral-900">
          대상 앱
        </label>
        <select
          id="pt-app"
          value={appId}
          onChange={(e) => setAppId(Number(e.target.value))}
          className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
        >
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold text-neutral-900">테스터 인원 (시트)</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {counts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-lg border px-0 py-2.5 text-sm font-semibold transition ${
                count === n
                  ? "border-trust-600 bg-trust-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-trust-500"
              }`}
            >
              {n}명
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-900">결제 수단</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="pay_with"
            checked={effectivePayWith === "toss"}
            onChange={() => setPayWith("toss")}
          />
          카드·간편결제 (토스페이먼츠)
        </label>
        <label
          className={`flex items-center gap-2 text-sm ${canUseCredits ? "cursor-pointer" : "cursor-not-allowed text-neutral-400"}`}
        >
          <input
            type="radio"
            name="pay_with"
            disabled={!canUseCredits}
            checked={effectivePayWith === "credits"}
            onChange={() => setPayWith("credits")}
          />
          보유 크레딧 사용 (잔액 {balance.toLocaleString("ko-KR")})
          {!canUseCredits && " — 잔액 부족"}
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
        <span className="text-sm text-neutral-600">결제 금액</span>
        <span className="text-lg font-bold text-neutral-900">
          {amount.toLocaleString("ko-KR")}
          {effectivePayWith === "credits" ? " 크레딧" : "원"}
        </span>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !appId}
        className="w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {submitting ? "주문 생성 중…" : effectivePayWith === "credits" ? "크레딧으로 시트 열기" : "결제하기"}
      </button>
    </form>
  );
}
