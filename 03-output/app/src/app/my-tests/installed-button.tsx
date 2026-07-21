"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 설치 자가확인 — 개발자 모니터링에 "설치 확인 ✓"로 표시됨 */
export function InstalledButton({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await fetch(`/api/matches/${matchId}/installed`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={confirm}
      disabled={busy}
      className="rounded-lg border border-mint-500/40 bg-mint-500/5 px-2.5 py-1.5 text-xs font-semibold text-mint-500 hover:bg-mint-500/10 disabled:opacity-50"
      title="설치를 완료했다면 눌러주세요. 개발자에게 설치 확인으로 표시됩니다."
    >
      {busy ? "저장 중..." : "📲 앱 설치 완료했어요"}
    </button>
  );
}
