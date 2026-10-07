"use client";

import { Camera, Check } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

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
const COMMENT_MAX = 200;

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

/**
 * 오늘 체크인 — 유료 시트는 [오늘 체크인] → 스크린샷 선택 → 자동 제출 (탭 2번).
 * 한 줄 피드백은 선택 사항이라 버튼을 누르기 전에 미리 적어 둔다 (제출 중간에 묻지 않는다).
 */
export function CheckInButton({
  matchId,
  alreadyCheckedToday,
  expired,
  paidSeat = false,
  deadlineIso = null,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const commentId = useId();

  if (expired) {
    return (
      <Button variant="secondary" size="md" disabled>
        체크인 기간 만료
      </Button>
    );
  }

  if (alreadyCheckedToday) {
    return (
      <Badge tone="success" className="min-h-11 gap-1.5">
        <Check className="size-4" strokeWidth={2} aria-hidden="true" />
        오늘 체크인 완료
      </Badge>
    );
  }

  async function submit(file: File | null) {
    setBusy(true);
    setError(null);
    const init: RequestInit = { method: "POST" };
    if (paidSeat) {
      if (!file) {
        setError("앱 실행 화면 스크린샷 1장을 첨부해주세요.");
        setBusy(false);
        return;
      }
      const form = new FormData();
      form.append("screenshot", await shrinkIfNeeded(file));
      form.append("comment", comment.slice(0, COMMENT_MAX));
      init.body = form;
    }
    const res = await fetch(`/api/matches/${matchId}/checkins`, init);
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setError(data.message ?? "체크인에 실패했습니다.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  const errorLine = error && (
    <p role="alert" className="text-danger-700 m-0 text-[13px]">
      {error}
    </p>
  );

  if (paidSeat) {
    return (
      <div className="flex w-full flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          data-testid="checkin-file"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void submit(file);
          }}
        />
        <Button
          size="md"
          onClick={() => fileRef.current?.click()}
          loading={busy}
          className="self-start"
        >
          <Camera className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
          오늘 체크인
        </Button>
        <span className="text-ink-600 text-xs">
          스크린샷 1장을 고르면 바로 제출됩니다 · 앱 실행 화면 1장 · 알림·개인정보는 가려주세요
          {deadlineIso && (
            <>
              {" · 오늘 마감 "}
              <span className="font-mono tabular-nums">{deadlineLabel(deadlineIso)}</span>
            </>
          )}
        </span>
        <details className="text-ink-700 text-sm">
          <summary className="text-ink-900 hover:text-accent-600 inline-flex min-h-11 cursor-pointer items-center underline">
            한 줄 피드백 남기기 (선택)
          </summary>
          <label htmlFor={commentId} className="text-ink-600 mt-1 block text-xs">
            오늘 써본 느낌 한 줄 — 앱 등록자에게 전달되는 피드백이에요
          </label>
          <Input
            id={commentId}
            value={comment}
            maxLength={COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1.5"
          />
        </details>
        {errorLine}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="md" onClick={() => void submit(null)} loading={busy}>
        오늘 체크인
      </Button>
      {errorLine}
    </div>
  );
}
