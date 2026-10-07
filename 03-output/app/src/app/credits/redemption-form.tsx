"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REWARD_CATALOG, REWARD_KINDS, type RewardKind } from "@/lib/rewards";

type Props = {
  redeemable: number;
  minCredits: number;
  unitCredits: number;
};

/** 보상 교환 신청 — 기프티콘·네이버페이 포인트 (ADR-0017). 신청 즉시 크레딧이 차감된다. */
export function RedemptionForm({ redeemable, minCredits, unitCredits }: Props) {
  const router = useRouter();
  const maxUnits = Math.min(10, Math.floor(redeemable / unitCredits));
  const [kind, setKind] = useState<RewardKind>("gifticon");
  const [units, setUnits] = useState(1);
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (redeemable < minCredits) {
    return (
      <p className="text-sm text-ink-700">
        교환 가능 크레딧 <strong>{redeemable.toLocaleString("ko-KR")}</strong> — 유료 시트 완주로{" "}
        {minCredits.toLocaleString("ko-KR")} 이상 모으면 신청할 수 있습니다.
      </p>
    );
  }
  if (done) {
    return <p className="text-sm font-medium text-success-700">신청 완료 — 영업일 3일 내 연락처로 발송됩니다.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/credits/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, amount: units * unitCredits, contact, note }),
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

  const selected = REWARD_CATALOG[kind];

  return (
    <form onSubmit={submit} className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold text-ink-900">보상 종류</legend>
        {REWARD_KINDS.map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="reward_kind" checked={kind === k} onChange={() => setKind(k)} />
            {REWARD_CATALOG[k].title}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="rd-units" className="font-semibold text-ink-900">
          교환 금액
        </label>
        <select
          id="rd-units"
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          className="border border-ink-900 px-3 py-2 text-sm"
        >
          {Array.from({ length: maxUnits }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {(n * unitCredits).toLocaleString("ko-KR")} 크레딧 → {(n * unitCredits).toLocaleString("ko-KR")}원{" "}
              {selected.label}
            </option>
          ))}
        </select>
      </div>
      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder={selected.contactPlaceholder}
        required
        inputMode="tel"
        pattern="01[016789]-?[0-9]{3,4}-?[0-9]{4}"
        maxLength={13}
        className="w-full border border-ink-900 px-3 py-2 text-sm"
      />
      {kind === "gifticon" && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="원하는 브랜드 (예: 스타벅스, 편의점) — 선택"
          maxLength={200}
          className="w-full border border-ink-900 px-3 py-2 text-sm"
        />
      )}
      {error && <p className="text-sm font-medium text-danger-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {busy ? "신청 중…" : `${selected.label} 교환 신청`}
      </button>
      <p className="text-xs text-ink-600">
        신청 즉시 크레딧이 차감되고, 관리자가 확인 후 영업일 3일 내 문자로 발송합니다. 거절 시 전액 복구. 한
        번호는 한 계정에서만 쓸 수 있고, 처리 중에는 추가 신청이 안 됩니다. 현금 환급은 없습니다.
      </p>
    </form>
  );
}
