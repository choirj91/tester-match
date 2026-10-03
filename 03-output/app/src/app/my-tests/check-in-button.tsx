"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  matchId: number;
  alreadyCheckedToday: boolean;
  expired: boolean;
  /** 유료 시트 — 스크린샷 1장 필수 (ADR-0012) */
  paidSeat?: boolean;
};

export function CheckInButton({ matchId, alreadyCheckedToday, expired, paidSeat = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function submit(file: File | null) {
    setBusy(true);
    const init: RequestInit = { method: "POST" };
    if (paidSeat) {
      if (!file) {
        alert("앱 실행 화면 스크린샷 1장을 첨부해주세요.");
        setBusy(false);
        return;
      }
      const form = new FormData();
      form.append("screenshot", file);
      init.body = form;
    }
    const res = await fetch(`/api/matches/${matchId}/checkins`, init);
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      alert(data.message ?? "체크인에 실패했습니다.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (paidSeat) {
    return (
      <div className="flex flex-col items-end gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void submit(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-trust-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
        >
          {busy ? "업로드 중..." : "📷 스크린샷 올리고 체크인"}
        </button>
        <span className="text-[10px] text-neutral-400">앱 실행 화면 1장 · 5MB 이하</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void submit(null)}
      disabled={busy}
      className="rounded-lg bg-trust-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
    >
      {busy ? "처리 중..." : "오늘 체크인"}
    </button>
  );
}
