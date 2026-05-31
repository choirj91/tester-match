"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BoostToggle({ id, isBoost }: { id: number; isBoost: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(isBoost);

  async function toggle() {
    const next = !on;
    setBusy(true);
    const res = await fetch(`/api/apps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_boost: next }),
    });
    if (!res.ok) {
      alert("급구 설정에 실패했습니다.");
      setBusy(false);
      return;
    }
    setOn(next);
    setBusy(false);
    router.refresh();
  }

  return (
    <section
      className={`mt-8 rounded-2xl border p-6 shadow-sm transition ${
        on ? "border-spark-500/40 bg-spark-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">급구</h2>
            {on && (
              <span className="rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                BOOST
              </span>
            )}
            <span className="rounded-full bg-mint-500/10 px-2 py-0.5 text-[10px] font-bold text-mint-500">
              무료
            </span>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            {on
              ? "현재 매칭 목록 최상단에 노출 중입니다. 테스터를 더 빨리 모집할 수 있습니다."
              : "급구를 켜면 매칭 목록 최상단에 BOOST 배지와 함께 노출됩니다."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${
            on
              ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              : "bg-spark-500 text-white hover:bg-spark-600"
          }`}
        >
          {busy ? "처리 중..." : on ? "급구 끄기" : "급구 켜기"}
        </button>
      </div>
    </section>
  );
}
