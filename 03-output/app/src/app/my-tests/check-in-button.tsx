"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  matchId: number;
  alreadyCheckedToday: boolean;
  expired: boolean;
  /** 유료 시트 — 스크린샷 1장 필수 (ADR-0012) */
  paidSeat?: boolean;
  /** 오늘 체크인 창이 닫히는 시각 (참여 시각 기준 24시간 단위) */
  deadlineIso?: string | null;
};

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 1600;

function deadlineLabel(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 큰 스크린샷은 서버 5MB 제한에 걸리므로 브라우저에서 JPEG 로 줄인다. 실패하면 원본 그대로. */
async function shrinkIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function CheckInButton({
  matchId,
  alreadyCheckedToday,
  expired,
  paidSeat = false,
  deadlineIso = null,
}: Props) {
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
      const comment =
        window.prompt("오늘 써본 느낌 한 줄 (선택) — 앱 등록자에게 전달되는 피드백이에요", "") ?? "";
      const form = new FormData();
      form.append("screenshot", await shrinkIfNeeded(file));
      form.append("comment", comment.slice(0, 200));
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
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void submit(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-trust-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
        >
          {busy ? "업로드 중..." : "📷 스크린샷 올리고 체크인"}
        </button>
        <span className="text-[10px] text-neutral-400">
          앱 실행 화면 1장 · 알림·개인정보는 가려주세요
          {deadlineIso && ` · 오늘 마감 ${deadlineLabel(deadlineIso)}`}
        </span>
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
