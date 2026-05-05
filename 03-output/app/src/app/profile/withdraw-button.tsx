"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WithdrawButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (
      !confirm(
        "정말 탈퇴할까요?\n\n- 회원 정보가 즉시 익명화됩니다.\n- 진행 중 매칭은 자동 옵트아웃됩니다.\n- 보유 크레딧은 소멸되며 환불되지 않습니다.\n\n이 작업은 되돌릴 수 없습니다.",
      )
    )
      return;

    const confirmText = prompt('계속하려면 "탈퇴"를 입력해주세요.');
    if (confirmText !== "탈퇴") {
      alert("입력값이 일치하지 않아 취소되었습니다.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/profile", { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      alert(data.message ?? "탈퇴 처리에 실패했습니다.");
      setBusy(false);
      return;
    }
    alert("탈퇴 처리가 완료되었습니다.");
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-crimson-500/40 bg-white px-4 py-2 text-sm font-semibold text-crimson-500 hover:bg-crimson-500/10 disabled:opacity-50"
    >
      {busy ? "처리 중..." : "회원 탈퇴"}
    </button>
  );
}
