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
};

export function OrderForm({ apps }: Props) {
  const router = useRouter();
  const [appId, setAppId] = useState<number>(apps[0]?.id ?? 0);
  const [count, setCount] = useState<number>(PAID_TESTER_MIN_COUNT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ app_id: appId, tester_count: count }),
      });
      const data = (await res.json()) as { ok: boolean; order_code?: string; message?: string };
      if (!data.ok || !data.order_code) {
        setError(data.message ?? "주문 생성에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      router.push(`/paid-testers/checkout?order=${data.order_code}`);
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
        <p className="text-sm font-semibold text-neutral-900">테스터 인원</p>
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

      <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
        <span className="text-sm text-neutral-600">결제 금액</span>
        <span className="text-lg font-bold text-neutral-900">
          {paidTesterAmountKrw(count).toLocaleString("ko-KR")}원
        </span>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !appId}
        className="w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {submitting ? "주문 생성 중…" : "결제하기"}
      </button>
    </form>
  );
}
