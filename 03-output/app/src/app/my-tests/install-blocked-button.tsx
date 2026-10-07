"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 유료 시트에서 앱 설치가 불가능할 때 — 신뢰도 차감 없이 시트에서 빠진다 (참여 72시간 이내, 체크인 전) */
export function InstallBlockedButton({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (
      !confirm(
        "그룹 가입 후에도 초대 링크·스토어에서 설치가 안 되나요?\n신고하면 신뢰도 차감 없이 이 시트에서 빠지고, 앱 등록자에게 설정 확인 요청이 전달됩니다.",
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/matches/${matchId}/install-blocked`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      alert(data.message ?? "신고에 실패했습니다.");
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
      className="border border-ink-900 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-warning-700 hover:text-warning-700 disabled:opacity-50"
    >
      {busy ? "처리 중..." : "설치가 안 돼요"}
    </button>
  );
}
