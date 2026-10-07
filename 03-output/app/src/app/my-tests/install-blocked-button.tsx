"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
    <Button variant="secondary" size="sm" onClick={onClick} loading={busy}>
      설치가 안 돼요
    </Button>
  );
}
