"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
        setResult(`${j.sent}명에게 발송`);
      }
    } catch {
      setResult("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {result && (
        <span role="status" className="text-[13px] text-ink-700">
          {result}
        </span>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={send}
        loading={busy}
        title="오늘 체크인하지 않은 테스터에게 알림 (하루 1회)"
      >
        <Bell className="size-4" strokeWidth={1.8} aria-hidden="true" />
        {busy ? "발송 중..." : (
          <span>
            미체크인 <span className="tabular">{pendingCount}</span>명 리마인드
          </span>
        )}
      </Button>
    </div>
  );
}
