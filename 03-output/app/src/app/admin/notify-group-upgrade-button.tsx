"use client";

import { useState } from "react";

type Result = { ok: boolean; candidates?: number; sent?: number; skipped?: number; message?: string };

export function NotifyGroupUpgradeButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function send() {
    if (!confirm("레거시 앱 소유자 전체에게 공용 그룹 전환 알림을 발송할까요?\n(이미 받은 앱은 자동 스킵됩니다)")) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/notify-group-upgrade", { method: "POST" });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ ok: false, message: "네트워크 오류" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">공용 그룹 전환 알림</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        아직 공용 테스터 그룹을 쓰지 않는 앱의 소유자에게 전환 유도 인앱 알림을 보냅니다.
        앱당 1회만 발송되며, 여러 번 눌러도 중복되지 않습니다.
      </p>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="mt-4 rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {busy ? "발송 중..." : "알림 일괄 발송"}
      </button>
      {result && (
        <p
          className={`mt-3 text-sm font-semibold ${
            result.ok ? "text-mint-500" : "text-crimson-500"
          }`}
        >
          {result.ok
            ? `✓ 대상 ${result.candidates}건 · 발송 ${result.sent}건 · 스킵(기발송) ${result.skipped}건`
            : (result.message ?? "발송 실패")}
        </p>
      )}
    </div>
  );
}
