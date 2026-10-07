"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAppButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("정말 삭제할까요? 매칭이 진행 중이라면 중단됩니다.")) return;
    setBusy(true);
    const res = await fetch(`/api/apps/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제에 실패했습니다.");
      setBusy(false);
      return;
    }
    router.push("/apps");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className="inline-flex min-h-11 items-center justify-center border-[1.5px] border-danger-700 bg-white px-4 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-600"
    >
      {busy ? "삭제 중..." : "삭제"}
    </button>
  );
}
