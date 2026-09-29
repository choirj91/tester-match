"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EnsureSlotsButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await fetch(`/api/console/orders/${orderId}/slots`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="rounded-lg bg-trust-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-trust-700 disabled:opacity-50"
    >
      {busy ? "생성 중…" : "슬롯 생성"}
    </button>
  );
}
