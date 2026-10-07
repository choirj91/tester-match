"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** 설치 자가확인 — 개발자 모니터링에 "설치 확인"으로 표시됨 */
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
    <Button
      variant="secondary"
      size="sm"
      onClick={confirm}
      loading={busy}
      title="설치를 완료했다면 눌러주세요. 개발자에게 설치 확인으로 표시됩니다."
    >
      앱 설치 완료했어요
    </Button>
  );
}
