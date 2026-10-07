import { formatKrw } from "@/lib/credits";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";

/**
 * 테스터 1명 결제 금액이 어디에 쓰이는지 (ADR-0017) — 급구 신청·결제·랜딩이 같은 숫자를 보여 준다.
 * 보상 몫은 시트당 최대 보상(seat-reward-rules), 나머지는 부가세·카드 수수료·운영비.
 */
const REWARD_SHARE_KRW = SEAT_REWARD_MAX;
const OPERATING_SHARE_KRW = PAID_TESTER_PRICE_KRW - SEAT_REWARD_MAX;
const REWARD_PERCENT = Math.round((REWARD_SHARE_KRW / PAID_TESTER_PRICE_KRW) * 100);

export function FeeBreakdown({ className = "" }: { className?: string }) {
  const price = formatKrw(PAID_TESTER_PRICE_KRW);
  const reward = formatKrw(REWARD_SHARE_KRW);
  const operating = formatKrw(OPERATING_SHARE_KRW);

  return (
    <section className={` border border-warning-700 bg-warning-50 p-5 ${className}`}>
      <h2 className="text-sm font-bold text-warning-700">테스터 1명 {price}원은 이렇게 쓰입니다</h2>
      <div
        className="mt-3 flex h-9 overflow-hidden text-xs font-semibold"
        role="img"
        aria-label={`${price}원 중 테스터 보상 최대 ${reward}원, 운영 ${operating}원`}
      >
        <div
          className="bg-ink-900 flex items-center justify-center px-2 text-white"
          style={{ width: `${REWARD_PERCENT}%` }}
        >
          테스터 보상 최대 {reward}원
        </div>
        <div className="flex flex-1 items-center justify-center bg-warning-50 px-2 text-warning-700">
          운영 {operating}원
        </div>
      </div>
      <dl className="mt-4 space-y-3 text-sm leading-relaxed text-warning-700">
        <div>
          <dt className="font-semibold">테스터 보상 · 최대 {reward}원</dt>
          <dd>
            회사가 14일을 완주한 테스터에게 지급하는 보상 비용입니다. 크레딧으로 쌓이고 기프티콘이나
            네이버페이 포인트로 바뀝니다(최대치는 앱 출시 보너스 포함).
          </dd>
        </div>
        <div>
          <dt className="font-semibold">운영 · 나머지 {operating}원</dt>
          <dd>
            부가세, 카드 결제 수수료, 서버와 스크린샷 보관, 보상 발송, 문의 응대에 씁니다. 남는 돈은
            많지 않고, 그마저 서비스를 계속 운영하는 데 다시 씁니다.
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-warning-700">
        결제 후 못 채운 시트와 완주하지 못한 시트는 환불됩니다.
      </p>
    </section>
  );
}
