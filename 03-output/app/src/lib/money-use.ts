/**
 * 테스터 1명 결제 금액의 쓰임 (ADR-0017·0018) — 급구 신청·결제·홈이 같은 숫자를 보여 준다.
 * 보상 비용(최대) · 부가세 · 카드 결제 수수료를 빼고 남는 몫이 서버·운영에 쓰인다.
 * 클라이언트 컴포넌트에서도 쓰므로 서버 전용 모듈을 import 하지 않는다.
 */

import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";

/**
 * 카드 결제 수수료율 추정 (결제대행사 수수료, 수수료에 붙는 부가세 별도).
 * KG이니시스 계약 요율이 확정되면 이 값만 바꾼다 — 화면 문구에는 "약"을 붙인다.
 */
export const CARD_FEE_RATE = 0.033;
const VAT_RATE = 0.1;

export type MoneyUse = {
  price: number;
  /** 테스터 보상 비용 (최대치, 앱 출시 보너스 포함) */
  reward: number;
  /** 가격에 포함된 부가세 */
  vat: number;
  /** 카드 결제 수수료 추정 (수수료 부가세 포함, 10원 단위) */
  cardFee: number;
  /** 남는 몫 — 서버·스크린샷 보관·보상 발송·문의 응대 */
  operating: number;
};

export function splitMoneyUse(price: number, rewardMax: number): MoneyUse {
  const vat = Math.round((price * VAT_RATE) / (1 + VAT_RATE));
  const cardFee = Math.round((price * CARD_FEE_RATE * (1 + VAT_RATE)) / 10) * 10;
  const operating = Math.max(0, price - rewardMax - vat - cardFee);
  return { price, reward: rewardMax, vat, cardFee, operating };
}

export const MONEY_USE: MoneyUse = splitMoneyUse(PAID_TESTER_PRICE_KRW, SEAT_REWARD_MAX);
