"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  appId: number;
  alreadyJoined: boolean;
  isOwn: boolean;
  isFull: boolean;
};

export function OptInButton({ appId, alreadyJoined, isOwn, isFull }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isOwn) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-500"
      >
        본인 앱에는 참여할 수 없습니다
      </button>
    );
  }

  if (alreadyJoined) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-mint-500/10 px-5 py-3 text-sm font-semibold text-mint-500"
      >
        이미 참여중 — 내 테스트에서 확인
      </button>
    );
  }

  if (isFull) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-500"
      >
        정원 마감
      </button>
    );
  }

  async function onClick() {
    setBusy(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    if (!res.ok || !data.ok) {
      alert(data.message ?? "참여에 실패했습니다.");
      setBusy(false);
      return;
    }
    router.push(`/browse/${appId}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
    >
      {busy ? "처리 중..." : "이 앱 테스트에 참여하기"}
    </button>
  );
}
