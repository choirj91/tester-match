"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RewardActions({ id, canForfeit }: { id: number; canForfeit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "release" | "forfeit") {
    const note = window.prompt(
      action === "release" ? "판정 메모 (선택)" : "몰수 사유 (테스터에게 표시됩니다)",
      "",
    );
    if (note === null) return;
    if (action === "forfeit" && !window.confirm("보상을 몰수합니다. 되돌릴 수 없습니다. 진행할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seat-rewards", {
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
          onClick={() => run("release")}
          className="bg-success-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-success-700 disabled:opacity-50"
        >
          지급
        </button>
        {canForfeit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run("forfeit")}
            className="border border-ink-900 px-3.5 py-2 text-xs font-semibold text-ink-700 hover:border-danger-700 hover:text-danger-700 disabled:opacity-50"
          >
            몰수
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger-700">{error}</p>}
    </div>
  );
}
