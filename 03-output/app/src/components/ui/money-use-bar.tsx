import { formatKrw } from "@/lib/credits";
import { MONEY_USE } from "@/lib/money-use";

/**
 * 테스터 1명 결제 금액의 쓰임 막대 (Design C §5.4) — 숫자는 lib/money-use 한 곳에서.
 * 보상·부가세·카드 수수료를 떼고 남는 서버·운영 몫을 강조색으로 따로 보여 준다.
 */
const PARTS = [
  { key: "reward", label: "보상 비용 최대", value: MONEY_USE.reward, fill: "bg-ink-900" },
  { key: "vat", label: "부가세", value: MONEY_USE.vat, fill: "bg-ink-600" },
  { key: "cardFee", label: "카드 수수료 약", value: MONEY_USE.cardFee, fill: "bg-ink-200" },
  { key: "operating", label: "서버·운영", value: MONEY_USE.operating, fill: "bg-accent-600" },
] as const;

export function MoneyUseBar() {
  const price = formatKrw(MONEY_USE.price);
  const ariaLabel = `${price}원 중 ${PARTS.map((p) => `${p.label} ${formatKrw(p.value)}원`).join(", ")}`;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-ink-600">{price}원의 쓰임</span>
      <div className="flex h-3 border border-ink-900" role="img" aria-label={ariaLabel}>
        {PARTS.map((p, i) => (
          <div
            key={p.key}
            className={`${p.fill} ${i > 0 ? "border-l border-ink-900" : ""}`}
            style={{ width: `${(p.value / MONEY_USE.price) * 100}%` }}
          />
        ))}
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 font-mono text-[13px] text-ink-900 tabular-nums min-[481px]:grid-cols-4">
        {PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 border border-ink-900 ${p.fill}`} />
            <span className={p.key === "operating" ? "font-semibold text-accent-700" : undefined}>
              {p.label} {formatKrw(p.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
