"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RedemptionActions({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "done" | "reject") {
    const note = window.prompt(
      action === "done"
        ? "발송 내역 — 필수 (예: 스타벅스 5천원권, 주문번호 1234)"
        : "거절 사유 (사용자에게 표시)",
      "",
    );
    if (note === null) return;
    if (action === "reject" && !window.confirm("거절하면 크레딧이 환급됩니다. 진행할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/redemptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, admin_note: note }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) setError(data.message ?? "실패");
      else router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run("done")}
          className="bg-success-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-success-700 disabled:opacity-50"
        >
          발송 완료
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("reject")}
          className="border border-ink-900 px-3.5 py-2 text-xs font-semibold text-ink-700 hover:border-danger-700 hover:text-danger-700 disabled:opacity-50"
        >
          거절·환급
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger-700">{error}</p>}
    </div>
  );
}
