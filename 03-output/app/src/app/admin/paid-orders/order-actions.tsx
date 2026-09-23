"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaidOrderStatus } from "@/lib/paid-testers";

type Props = {
  orderId: number;
  status: PaidOrderStatus;
};

const BUTTONS: Array<{
  action: "start" | "complete" | "cancel";
  label: string;
  visibleFor: PaidOrderStatus[];
  confirm?: string;
  tone: string;
}> = [
  {
    action: "start",
    label: "테스트 개시",
    visibleFor: ["paid"],
    tone: "bg-trust-600 text-white hover:bg-trust-700",
  },
  {
    action: "complete",
    label: "완료",
    visibleFor: ["in_progress"],
    tone: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  {
    action: "cancel",
    label: "취소",
    visibleFor: ["pending", "paid"],
    confirm: "주문을 취소할까요? 결제된 주문은 토스 대시보드에서 환불을 먼저 처리하세요.",
    tone: "border border-neutral-300 text-neutral-600 hover:border-red-400 hover:text-red-600",
  },
];

export function OrderActions({ orderId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = BUTTONS.filter((b) => b.visibleFor.includes(status));
  if (visible.length === 0) return null;

  async function run(action: "start" | "complete" | "cancel", confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/paid-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, action }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "실패했습니다.");
      } else {
        router.refresh();
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <div className="flex gap-2">
        {visible.map((b) => (
          <button
            key={b.action}
            type="button"
            disabled={busy}
            onClick={() => run(b.action, b.confirm)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${b.tone}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
