/**
 * 크레딧 이상 징후 — 일일 관리자 리포트·Slack 에 싣는다.
 * 조회는 DB 함수 credit_anomaly_report (마이그레이션 20261007000001) 한 번으로 끝낸다.
 * 회원은 id 로만 표시한다 (리포트가 메일·Slack 으로 나간다 — 이메일·닉네임 금지).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatKrw } from "@/lib/credits";
import { PAID_SEAT_MAX_CONCURRENT } from "@/lib/paid-seats";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";

/** 24시간 적립 경보 기준 — 동시에 잡을 수 있는 시트 수 × 시트당 최대 보상 (정상 최대치) */
export const CREDIT_GRANT_ALERT_THRESHOLD = SEAT_REWARD_MAX * PAID_SEAT_MAX_CONCURRENT;
/** 24시간 교환 신청 경보 기준 */
export const CREDIT_REDEMPTION_ALERT_THRESHOLD = 20000;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MEMBERS_PER_LINE = 5;

export type CreditAnomalyRow = {
  kind: string;
  user_id: number;
  amount: number;
  detail: string;
  /** 이 종류의 전체 행 수 — DB 는 종류마다 상위 20행만 돌려준다 */
  kind_total: number;
};

const KIND_LABEL: Record<string, string> = {
  grant_spike: `24시간 적립 ${formatKrw(CREDIT_GRANT_ALERT_THRESHOLD)} 이상`,
  retired_type: "폐지된 적립 유형(welcome·charge) 기록",
  manual_adjust: "운영자 수동 조정",
  unknown_earn: "유료 시트 외 적립(earn)",
  duplicate_earn: "같은 근거로 중복 적립",
  negative_balance: "잔액 0 미만",
  balance_mismatch: "장부 합과 마지막 잔액 불일치",
  large_redemption: `24시간 교환 신청 ${formatKrw(CREDIT_REDEMPTION_ALERT_THRESHOLD)} 이상`,
};

/** 종류별 한 줄 — "크레딧 이상 · 24시간 적립 2,100 이상: 2건 (#12 3,400 (6건) · #55 2,800 (4건))" */
export function formatCreditAnomalies(rows: ReadonlyArray<CreditAnomalyRow>): string[] {
  const byKind = new Map<string, CreditAnomalyRow[]>();
  for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);

  return [...byKind.entries()].map(([kind, list]) => {
    const total = Math.max(list.length, ...list.map((r) => Number(r.kind_total) || 0));
    const members = new Set(list.map((r) => r.user_id)).size;
    // 한 회원이 여러 행일 수 있다 (수동 조정 여러 건 등) — 건수와 회원 수를 따로 적는다
    const count = members === total ? `${total}건` : `${total}건 · 회원 ${members}명 이상`;
    const shown = list
      .slice(0, MEMBERS_PER_LINE)
      .map(
        (r) => `#${r.user_id} ${formatKrw(Number(r.amount))}${r.detail ? ` (${r.detail})` : ""}`,
      );
    const shownCount = Math.min(list.length, MEMBERS_PER_LINE);
    const rest = total > shownCount ? ` 외 ${total - shownCount}건` : "";
    return `크레딧 이상 · ${KIND_LABEL[kind] ?? kind}: ${count} (${shown.join(" · ")}${rest})`;
  });
}

/**
 * 최근 24시간 기준 이상 징후를 조회해 경보 문장으로 돌려준다.
 * 조회 실패도 경보 한 줄로 알린다 — "이상 없음"으로 오해하지 않게.
 */
export async function loadCreditAnomalyAlerts(
  supabase: SupabaseClient,
  now: Date,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("credit_anomaly_report", {
    p_since: new Date(now.getTime() - LOOKBACK_MS).toISOString(),
    p_grant_threshold: CREDIT_GRANT_ALERT_THRESHOLD,
    p_redemption_threshold: CREDIT_REDEMPTION_ALERT_THRESHOLD,
  });
  if (error) {
    console.error("[credit-anomalies] report query failed", error.message);
    return ["크레딧 이상 징후 조회 실패 — 직접 확인이 필요합니다."];
  }
  return formatCreditAnomalies((data ?? []) as CreditAnomalyRow[]);
}
