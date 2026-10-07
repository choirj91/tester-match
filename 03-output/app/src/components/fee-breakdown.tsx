import { formatKrw } from "@/lib/credits";
import { CARD_FEE_RATE, MONEY_USE } from "@/lib/money-use";
import { MoneyUseBar } from "@/components/ui/money-use-bar";
import { Receipt, ReceiptDivider } from "@/components/ui/receipt";

/**
 * 테스터 1명 결제 금액이 어디에 쓰이는지 (ADR-0017) — 급구 신청·결제·랜딩이 같은 숫자를 보여 준다.
 * 숫자는 lib/money-use — 보상 비용(최대) · 부가세 · 카드 수수료(추정) · 남는 서버·운영 몫.
 * 모양은 영수증(Design C §5.3) + 쓰임 막대(§5.4).
 */
const CARD_FEE_PERCENT = (CARD_FEE_RATE * 100).toFixed(1);
/** 한 화면에 한 번만 쓰인다 (급구 신청·결제) */
const TITLE_ID = "fee-breakdown-title";

export function FeeBreakdown({
  className = "",
  showBar = true,
}: {
  className?: string;
  /** 같은 화면의 영수증에 쓰임 막대가 이미 있으면 끈다 */
  showBar?: boolean;
}) {
  const price = formatKrw(MONEY_USE.price);
  const reward = formatKrw(MONEY_USE.reward);

  return (
    <section className={className} aria-labelledby={TITLE_ID}>
      <Receipt
        title={<span id={TITLE_ID}>테스터 1명 {price}원은 이렇게 쓰입니다</span>}
        footer={<>결제 후 못 채운 시트와 완주하지 못한 시트는 환불됩니다.</>}
      >
        {showBar && (
          <>
            <ReceiptDivider />
            <MoneyUseBar />
          </>
        )}
        <ReceiptDivider />
        <dl className="text-ink-700 m-0 flex flex-col gap-4 text-sm leading-relaxed">
          <div className="flex flex-col gap-1">
            <dt className="text-ink-900 flex justify-between gap-3 font-mono font-medium tabular-nums">
              <span>테스터 보상</span>
              <span>최대 {reward}원</span>
            </dt>
            <dd className="m-0">
              회사가 14일을 완주한 테스터에게 지급하는 보상 비용입니다. 크레딧으로 쌓이고
              기프티콘이나 네이버페이 포인트로 바뀝니다(최대치는 앱 출시 보너스 포함).
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-ink-900 flex justify-between gap-3 font-mono font-medium tabular-nums">
              <span>부가세</span>
              <span>{formatKrw(MONEY_USE.vat)}원</span>
            </dt>
            <dd className="m-0">가격에 포함된 부가세입니다.</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-ink-900 flex justify-between gap-3 font-mono font-medium tabular-nums">
              <span>카드 결제 수수료</span>
              <span>약 {formatKrw(MONEY_USE.cardFee)}원</span>
            </dt>
            <dd className="m-0">
              결제대행사에 내는 수수료입니다(결제 금액의 약 {CARD_FEE_PERCENT}%와 그 부가세).
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="flex justify-between gap-3 font-mono font-semibold text-accent-700 tabular-nums">
              <span>서버·운영</span>
              <span>{formatKrw(MONEY_USE.operating)}원</span>
            </dt>
            <dd className="m-0">
              서버와 스크린샷 보관, 보상 발송, 문의 응대에 씁니다. 남는 돈은 많지 않고, 그마저
              서비스를 계속 운영하는 데 다시 씁니다.
            </dd>
          </div>
        </dl>
        <ReceiptDivider />
      </Receipt>
    </section>
  );
}
