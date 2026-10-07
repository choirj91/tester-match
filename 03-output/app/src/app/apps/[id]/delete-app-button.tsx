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
      className="border border-danger-700 bg-white px-3 py-2 text-sm font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-50"
    >
      {busy ? "삭제 중..." : "삭제"}
    </button>
  );
}
