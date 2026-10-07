"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
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
      <p className="m-0 text-sm text-ink-700">
        교환 가능 크레딧{" "}
        <strong className="font-mono text-ink-900 tabular-nums">{redeemable.toLocaleString("ko-KR")}</strong> — 유료
        시트 완주로 <span className="font-mono tabular-nums">{minCredits.toLocaleString("ko-KR")}</span> 이상 모으면
        신청할 수 있습니다.
      </p>
    );
  }
  if (done) {
    return (
      <p role="status" className="m-0 flex items-center gap-1.5 text-sm font-medium text-success-700">
        <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        신청 완료 — 영업일 3일 내 연락처로 발송됩니다.
      </p>
    );
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-medium text-ink-900">보상 종류</legend>
        {REWARD_KINDS.map((k) => (
          <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink-900">
            <input
              type="radio"
              name="reward_kind"
              checked={kind === k}
              onChange={() => setKind(k)}
              className="size-5 shrink-0 cursor-pointer accent-ink-900"
            />
            {REWARD_CATALOG[k].title}
          </label>
        ))}
      </fieldset>
      <Field label="교환 크레딧">
        {({ id }) => (
          <Select id={id} value={units} onChange={(e) => setUnits(Number(e.target.value))} className="font-mono">
            {Array.from({ length: maxUnits }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {(n * unitCredits).toLocaleString("ko-KR")} 크레딧 → {selected.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder={selected.contactPlaceholder}
        aria-label={selected.contactPlaceholder}
        required
        inputMode="tel"
        pattern="01[016789]-?[0-9]{3,4}-?[0-9]{4}"
        maxLength={13}
      />
      {kind === "gifticon" && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="원하는 브랜드 (예: 스타벅스, 편의점) — 선택"
          aria-label="원하는 브랜드 (예: 스타벅스, 편의점) — 선택"
          maxLength={200}
        />
      )}
      {error && (
        <p role="alert" className="m-0 flex items-center gap-1.5 text-[13px] text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="self-start">
        {busy ? "신청 중…" : `${selected.label} 교환 신청`}
      </Button>
      <p className="m-0 text-xs leading-relaxed text-ink-600">
        신청 즉시 크레딧이 차감되고, 관리자가 확인 후 영업일 3일 내 문자로 발송합니다. 거절 시 전액 복구. 한
        번호는 한 계정에서만 쓸 수 있고, 처리 중에는 추가 신청이 안 됩니다. 현금 환급은 없습니다.
      </p>
    </form>
  );
}
