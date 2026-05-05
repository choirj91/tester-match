"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  matchId: number;
  alreadyCheckedToday: boolean;
  expired: boolean;
};

export function CheckInButton({ matchId, alreadyCheckedToday, expired }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (expired) {
    return (
      <button
        type="button"
        disabled
        className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-500"
      >
        체크인 기간 만료
      </button>
    );
  }

  if (alreadyCheckedToday) {
    return (
      <button
        type="button"
        disabled
        className="rounded-lg bg-mint-500/10 px-3 py-1.5 text-xs font-semibold text-mint-500"
      >
        ✓ 오늘 체크인 완료
      </button>
    );
  }

  async function onClick() {
    setBusy(true);
    const res = await fetch(`/api/matches/${matchId}/checkins`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      alert(data.message ?? "체크인에 실패했습니다.");
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
      className="rounded-lg bg-trust-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
    >
      {busy ? "처리 중..." : "오늘 체크인"}
    </button>
  );
}
