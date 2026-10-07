"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";

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
      <ButtonLink href={`/board/${id}/edit`} variant="secondary" size="sm">
        수정
      </ButtonLink>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-busy={busy || undefined}
        className="inline-flex min-h-11 items-center justify-center border-[1.5px] border-danger-700 bg-white px-4 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-600"
      >
        {busy ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}
