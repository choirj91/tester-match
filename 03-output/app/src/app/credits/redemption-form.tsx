"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleAlert, Minus, Plus } from "lucide-react";
import { RewardIcon } from "@/components/reward-icon";
import { Button } from "@/components/ui/button";
import { ConsentList, Field, Input, type ConsentItem } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import {
  REDEMPTION_MAX_CREDITS,
  REWARD_ITEMS,
  REWARD_MIN_ITEM_CREDITS,
  REWARD_PROCESSING_BUSINESS_DAYS,
  findRewardItem,
  quoteRedemption,
  rewardItemSummary,
  rewardItemTitle,
  rewardMaxQuantity,
} from "@/lib/rewards";
import { REDEMPTION_NOTE_MAX } from "@/lib/validators/redemption";

type Props = {
  redeemable: number;
  /** /rewards 상품 카드에서 넘어온 상품 (?item=) */
  initialItemCode: string | null;
  /** 처리 대기 신청이 있으면 새 신청을 받지 않는다 (서버도 막는다) */
  hasPending: boolean;
};

const CONSENT: ReadonlyArray<ConsentItem> = [
  {
    key: "deduct",
    label: "신청 즉시 크레딧이 차감되고, 거절될 때만 복구된다는 데 동의합니다",
    href: "/policies/credits",
    required: true,
  },
];

const LINK = "text-ink-900 underline underline-offset-2 hover:text-accent-600";

function fmt(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** 처음 고를 상품 — 넘어온 상품, 없으면 교환 가능한 가장 비싼 상품, 그것도 없으면 첫 상품 */
function initialCode(initialItemCode: string | null, redeemable: number): string {
  const fromLink = findRewardItem(initialItemCode);
  if (fromLink) return fromLink.code;
  const affordable = REWARD_ITEMS.filter((item) => item.credits <= redeemable);
  return (affordable.at(-1) ?? REWARD_ITEMS[0]).code;
}

/**
 * 보상 교환 신청 — 교환 상품 1종 × 수량 (ADR-0017, ADR-0020). 신청 즉시 크레딧이 차감된다.
 * 합계는 화면에서 미리 보여 줄 뿐이고, 차감 크레딧은 서버가 상품 코드로 다시 계산한다.
 */
export function RedemptionForm({ redeemable, initialItemCode, hasPending }: Props) {
  const router = useRouter();
  const [itemCode, setItemCode] = useState(() => initialCode(initialItemCode, redeemable));
  const [quantity, setQuantity] = useState(1);
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p role="status" className="m-0 flex items-center gap-1.5 text-sm font-medium text-success-700">
        <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        신청 완료 — 영업일 {REWARD_PROCESSING_BUSINESS_DAYS}일 내 연락처로 발송됩니다.
      </p>
    );
  }
  if (hasPending) {
    return (
      <Notice kind="info">
        처리 대기 중인 교환 신청이 있습니다. 처리가 끝나면 새로 신청할 수 있습니다.
      </Notice>
    );
  }
  if (redeemable < REWARD_MIN_ITEM_CREDITS) {
    return (
      <p className="m-0 text-sm text-ink-700">
        교환 가능 크레딧{" "}
        <strong className="font-mono text-ink-900 tabular-nums">{fmt(redeemable)}</strong> — 유료 시트 완주로{" "}
        <span className="font-mono tabular-nums">{fmt(REWARD_MIN_ITEM_CREDITS)}</span> 크레딧 이상 모으면
        신청할 수 있습니다.{" "}
        <Link href="/rewards" className={LINK}>
          교환 상품 보기
        </Link>
      </p>
    );
  }

  const item = findRewardItem(itemCode) ?? REWARD_ITEMS[0];
  const maxQuantity = rewardMaxQuantity(item);
  const quote = quoteRedemption(item.code, quantity);
  const total = quote.ok ? quote.total : item.credits * quantity;
  const shortage = Math.max(0, total - redeemable);
  const consented = CONSENT.every((c) => !c.required || consent[c.key]);
  const canSubmit = quote.ok && shortage === 0 && consented && contact.trim().length > 0 && !busy;

  function selectItem(code: string) {
    const next = findRewardItem(code);
    if (!next) return;
    setItemCode(next.code);
    setQuantity((q) => Math.min(q, rewardMaxQuantity(next)));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/credits/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_code: item.code, quantity, contact, note }),
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-medium text-ink-900">교환 상품</legend>
        <ul className="m-0 flex list-none flex-col border-t border-ink-900 p-0">
          {REWARD_ITEMS.map((option) => (
            <li key={option.code} className="border-b border-ink-200">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 px-1 py-2 has-[:checked]:bg-surface-1">
                <input
                  type="radio"
                  name="reward_item"
                  value={option.code}
                  checked={option.code === item.code}
                  onChange={() => selectItem(option.code)}
                  className="size-5 shrink-0 cursor-pointer accent-ink-900"
                />
                <RewardIcon icon={option.icon} className="size-9" />
                <span className="min-w-0 flex-1 text-[15px] text-ink-900">{rewardItemTitle(option)}</span>
                <span className="shrink-0 font-mono text-sm whitespace-nowrap text-ink-900 tabular-nums">
                  {fmt(option.credits)} 크레딧
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <span id="redeem-qty-label" className="text-sm font-medium text-ink-900">
          수량
        </span>
        <div role="group" aria-labelledby="redeem-qty-label" className="flex items-center">
          <Button
            variant="secondary"
            size="sm"
            className="w-11 px-0"
            aria-label="수량 줄이기"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </Button>
          <output
            aria-live="polite"
            aria-label={`수량 ${quantity}개`}
            className="flex h-11 min-w-14 items-center justify-center border-y-[1.5px] border-ink-900 bg-white font-mono text-[15px] text-ink-900 tabular-nums"
          >
            {quantity}
          </output>
          <Button
            variant="secondary"
            size="sm"
            className="w-11 px-0"
            aria-label="수량 늘리기"
            disabled={quantity >= maxQuantity}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </div>
        <p className="m-0 text-[13px] text-ink-600">
          한 번에 최대 {maxQuantity}개, {fmt(REDEMPTION_MAX_CREDITS)} 크레딧까지
        </p>
      </div>

      <Receipt title="신청 내역" className="px-5 py-5">
        <ReceiptRows>
          <ReceiptRow
            label={rewardItemSummary(item, quantity)}
            value={<span className="whitespace-nowrap">{fmt(total)} 크레딧</span>}
            strong
          />
        </ReceiptRows>
        <ReceiptDivider />
        <ReceiptRows>
          <ReceiptRow label="교환 가능" value={`${fmt(redeemable)} 크레딧`} />
          {shortage > 0 ? (
            <ReceiptRow
              label="부족"
              value={<span className="text-danger-700">{fmt(shortage)} 크레딧</span>}
            />
          ) : (
            <ReceiptRow label="신청 후 교환 가능" value={`${fmt(redeemable - total)} 크레딧`} />
          )}
        </ReceiptRows>
      </Receipt>

      <Field label="받을 휴대폰 번호" hint="한 번호는 한 계정에서만 쓸 수 있습니다.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="010-1234-5678"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="01[016789]-?[0-9]{3,4}-?[0-9]{4}"
            maxLength={13}
          />
        )}
      </Field>
      <Field label="요청 사항 (선택)">
        {({ id }) => (
          <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={REDEMPTION_NOTE_MAX} />
        )}
      </Field>

      <ConsentList items={CONSENT} checked={consent} onChange={setConsent} showAllToggle={false} />

      {error && (
        <p role="alert" className="m-0 flex items-center gap-1.5 text-[13px] text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}
      <Button type="submit" loading={busy} disabled={!canSubmit} className="self-start">
        교환 신청
      </Button>
      <p className="m-0 text-xs leading-relaxed text-ink-600">
        관리자가 확인한 뒤 영업일 {REWARD_PROCESSING_BUSINESS_DAYS}일 내 휴대폰으로 보내 드립니다. 거절되면
        차감한 크레딧을 전액 복구합니다. 처리 중에는 새로 신청할 수 없습니다. 현금 환급은 없습니다.
      </p>
    </form>
  );
}
