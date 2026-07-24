"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OptOutButton({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (
      !confirm(
        "테스트를 중도 포기하면 신뢰도가 3점 차감됩니다.\n(무단 이탈 시에는 10점 차감 — 포기하실 거라면 옵트아웃이 유리합니다.)\n\n계속하시겠습니까?",
      )
    )
      return;
    const reason = prompt("옵트아웃 사유를 적어주세요 (선택). 매칭 통계 개선에 사용됩니다.");
    if (reason === null) return; // cancelled

    setBusy(true);
    const res = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || undefined }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      alert(data.message ?? "옵트아웃에 실패했습니다.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-crimson-500/30 bg-white px-3 py-1.5 text-xs font-semibold text-crimson-500 hover:bg-crimson-500/10 disabled:opacity-50"
    >
      {busy ? "처리 중..." : "옵트아웃"}
    </button>
  );
}
