"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAY_GROUP_JOIN_URL } from "@/lib/tester-group";

/**
 * Play 테스터 자격 그룹(consumer) 가입 유도 인라인 프롬프트.
 * consumer 그룹은 API 자동 추가 불가 → 1클릭 가입 + 자가확인.
 */
export function PlayGroupJoinPrompt({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markJoined() {
    setBusy(true);
    try {
      await fetch("/api/groups/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ play: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "mt-2 flex flex-wrap items-center gap-2" : "mt-3 flex flex-wrap items-center gap-3"}>
      <a
        href={PLAY_GROUP_JOIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`rounded-lg bg-amber-500 font-semibold text-white shadow-sm hover:bg-amber-600 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-xs"
        }`}
      >
        그룹 가입하기 (1클릭) ↗
      </a>
      <button
        type="button"
        onClick={markJoined}
        disabled={busy}
        className={`rounded-lg border border-mint-500/40 bg-white font-semibold text-mint-500 hover:bg-mint-500/10 disabled:opacity-50 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-xs"
        }`}
      >
        {busy ? "저장 중..." : "가입 완료했어요 ✓"}
      </button>
    </div>
  );
}
