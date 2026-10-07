import { formatKrw } from "@/lib/credits";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";

/** 테스터 1명 결제 금액 중 보상 몫(최대)과 운영 몫 — ADR-0017 */
export const MONEY_USE = {
  price: PAID_TESTER_PRICE_KRW,
  reward: SEAT_REWARD_MAX,
  operating: PAID_TESTER_PRICE_KRW - SEAT_REWARD_MAX,
} as const;

export function MoneyUseBar() {
  const rewardPct = (MONEY_USE.reward / MONEY_USE.price) * 100;
  const price = formatKrw(MONEY_USE.price);
  const reward = formatKrw(MONEY_USE.reward);
  const operating = formatKrw(MONEY_USE.operating);
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-ink-600">{price}원의 쓰임</span>
      <div
        className="flex h-3 border border-ink-900"
        role="img"
        aria-label={`${price}원 중 테스터 보상 최대 ${reward}원, 운영 ${operating}원`}
      >
        <div className="bg-ink-900" style={{ width: `${rewardPct}%` }} />
        <div className="flex-1 border-l border-ink-900 bg-white" />
      </div>
      <div className="flex flex-wrap justify-between gap-3 font-mono text-[13px] text-ink-900 tabular-nums">
        <span>보상 비용 최대 {reward}</span>
        <span>부가세·수수료·서버·운영 {operating}</span>
      </div>
    </div>
  );
}
