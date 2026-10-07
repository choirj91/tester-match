"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PostActions({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("이 글을 삭제할까요?")) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제에 실패했습니다.");
      setBusy(false);
      return;
    }
    router.push("/board");
    router.refresh();
  }

  return (
    <div className="mt-8 flex items-center gap-2 border-t border-ink-200 pt-4">
      <Link
        href={`/board/${id}/edit`}
        className="border border-ink-900 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-1"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="border border-danger-700 bg-white px-3 py-1.5 text-xs font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-50"
      >
        {busy ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}
