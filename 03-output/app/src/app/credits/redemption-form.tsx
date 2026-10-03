"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  redeemable: number;
  minCredits: number;
  unitCredits: number;
};

export function RedemptionForm({ redeemable, minCredits, unitCredits }: Props) {
  const router = useRouter();
  const maxUnits = Math.floor(redeemable / unitCredits);
  const [units, setUnits] = useState(1);
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (redeemable < minCredits) {
    return (
      <p className="text-sm text-neutral-600">
        교환 가능 크레딧 <strong>{redeemable.toLocaleString("ko-KR")}</strong> — 유료 시트 완주로{" "}
        {minCredits.toLocaleString("ko-KR")} 이상 모으면 신청할 수 있습니다.
      </p>
    );
  }
  if (done) {
    return <p className="text-sm font-medium text-mint-500">신청 완료 — 영업일 3일 내 연락처로 발송됩니다.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/credits/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: units * unitCredits, contact, note }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "신청에 실패했습니다.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="rd-units" className="font-semibold text-neutral-900">
          교환 금액
        </label>
        <select
          id="rd-units"
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {Array.from({ length: maxUnits }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {(n * unitCredits).toLocaleString("ko-KR")} 크레딧 → {(n * unitCredits).toLocaleString("ko-KR")}원 기프티콘
            </option>
          ))}
        </select>
      </div>
      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="기프티콘 받을 휴대폰 번호 또는 카카오톡 ID"
        required
        minLength={5}
        maxLength={80}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="원하는 브랜드 (예: 스타벅스, 편의점) — 선택"
        maxLength={200}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white hover:bg-trust-700 disabled:opacity-50"
      >
        {busy ? "신청 중…" : "기프티콘 교환 신청"}
      </button>
      <p className="text-xs text-neutral-500">
        신청 즉시 크레딧이 차감되고, 관리자가 확인 후 수동 발송합니다. 거절 시 전액 환급.
      </p>
    </form>
  );
}
