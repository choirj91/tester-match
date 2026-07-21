"use client";

import { useState } from "react";

/** 오늘 미체크인 테스터에게 리마인드 알림 발송 (테스터·앱당 하루 1회) */
export function RemindButton({ appId, pendingCount }: { appId: number; pendingCount: number }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/apps/${appId}/remind`, { method: "POST" });
      const j = (await res.json()) as {
        ok: boolean;
        sent?: number;
        skipped?: number;
        message?: string;
      };
      if (!res.ok || !j.ok) {
        setResult(j.message ?? "발송 실패");
        return;
      }
      if ((j.sent ?? 0) === 0 && (j.skipped ?? 0) > 0) {
        setResult("오늘은 이미 발송했습니다");
      } else {
        setResult(`✓ ${j.sent}명에게 발송`);
      }
    } catch {
      setResult("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-neutral-500">{result}</span>}
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        title="오늘 체크인하지 않은 테스터에게 알림 (하루 1회)"
      >
        {busy ? "발송 중..." : `🔔 미체크인 ${pendingCount}명 리마인드`}
      </button>
    </div>
  );
}
