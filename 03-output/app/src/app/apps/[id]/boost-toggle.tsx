"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatRemaining(deadline: string | null): {
  label: string;
  urgent: boolean;
} {
  if (!deadline) return { label: "", urgent: false };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { label: "만료됨", urgent: true };
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  if (days >= 1) return { label: `${days}일 남음`, urgent: days <= 1 };
  return { label: `${hours}시간 남음`, urgent: true };
}

export function BoostToggle({
  id,
  isBoost,
  deadlineAt,
}: {
  id: number;
  isBoost: boolean;
  deadlineAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(isBoost);
  const [deadline, setDeadline] = useState<string | null>(deadlineAt);

  const remaining = formatRemaining(deadline);
  const isExpired = on && deadline && new Date(deadline).getTime() <= Date.now();

  async function patch(is_boost: boolean) {
    setBusy(true);
    const res = await fetch(`/api/apps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_boost }),
    });
    if (!res.ok) {
      alert("급구 설정에 실패했습니다.");
      setBusy(false);
      return;
    }
    setOn(is_boost);
    if (is_boost) {
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setDeadline(d.toISOString());
    } else {
      setDeadline(null);
    }
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">급구</h2>
            {on && !isExpired && (
              <span className="rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                BOOST
              </span>
            )}
            <span className="rounded-full bg-mint-500/10 px-2 py-0.5 text-[10px] font-bold text-mint-500">
              무료
            </span>
            {on && remaining.label && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  remaining.urgent
                    ? "bg-crimson-500/10 text-crimson-500"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                ⏳ {remaining.label}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            {isExpired
              ? "급구 기간이 만료되었습니다. 갱신해서 다시 최상단에 노출하세요."
              : on
                ? `매칭 목록 최상단에 노출 중. 7일 후 자동 해제됩니다. 갱신하면 7일 연장됩니다.`
                : "급구를 켜면 매칭 목록 최상단에 7일간 노출됩니다. 무료입니다."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {on && !isExpired && (
            <button
              type="button"
              onClick={() => patch(true)}
              disabled={busy}
              className="rounded-lg border border-spark-500 bg-white px-4 py-2.5 text-sm font-semibold text-spark-600 shadow-sm transition hover:bg-spark-50 disabled:opacity-50"
            >
              {busy ? "처리 중..." : "갱신 (+7일)"}
            </button>
          )}
          <button
            type="button"
            onClick={() => patch(!on)}
            disabled={busy}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${
              on
                ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                : "bg-spark-500 text-white hover:bg-spark-600"
            }`}
          >
            {busy ? "처리 중..." : on ? "급구 끄기" : "급구 켜기 (7일)"}
          </button>
        </div>
      </div>
    </section>
  );
}
