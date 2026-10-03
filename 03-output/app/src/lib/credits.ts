import type { SupabaseClient } from "@supabase/supabase-js";

export async function getBalance(
  supabase: SupabaseClient,
  userId: number,
): Promise<number> {
  const { data } = await supabase
    .from("credits_ledger")
    .select("amount")
    .eq("user_id", userId);
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

export const CREDIT_TYPE_LABEL: Record<string, string> = {
  welcome: "가입 보너스",
  earn: "적립",
  charge: "충전",
  spend: "사용",
  refund: "환불",
  penalty: "페널티",
  adjust: "조정",
  expire: "만료",
};

export function formatKrw(value: number): string {
  return value.toLocaleString("ko-KR");
}

export type LedgerType =
  | "welcome"
  | "earn"
  | "charge"
  | "spend"
  | "refund"
  | "penalty"
  | "adjust"
  | "expire";

/** 유료 시트 완주 적립 — 기프티콘 교환 가능 크레딧의 유일한 원천 (ADR-0012) */
export const PAID_SEAT_LEDGER_REF = "paid_seat";
/** 앱 정식 출시 보너스 — 유료 시트에서 파생된 적립이라 교환 가능 */
export const PAID_SEAT_LAUNCH_LEDGER_REF = "paid_seat_launch";
/** 기프티콘 교환 차감/환급 */
export const REDEMPTION_LEDGER_REF = "redemption";

export type AppendLedgerArgs = {
  userId: number;
  amount: number;
  type: LedgerType;
  refType?: string;
  refId?: number | null;
  description?: string;
  /** true 면 교환 가능액(유료 시트 적립분, 잔액 상한)까지 검증 — 기프티콘 교환용 */
  capRedeemable?: boolean;
};

export type AppendLedgerResult =
  | { ok: true; id: number; duplicate: false }
  | { ok: true; id: null; duplicate: true }
  | { ok: false; message: string };

/**
 * 원장 append — DB 함수 ledger_append 가 유저별 advisory lock 안에서 잔액 검증 + INSERT.
 * 같은 ref 로 이미 기록된 경우(부분 unique) null 을 돌려주며 duplicate=true 로 멱등 처리한다.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  args: AppendLedgerArgs,
): Promise<AppendLedgerResult> {
  const { data, error } = await supabase.rpc("ledger_append", {
    p_user: args.userId,
    p_amount: args.amount,
    p_type: args.type,
    p_ref_type: args.refType ?? null,
    p_ref_id: args.refId ?? null,
    p_desc: args.description ?? null,
    p_cap_redeemable: args.capRedeemable ?? false,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT")) {
      return { ok: false, message: "크레딧 잔액이 부족합니다." };
    }
    if (error.message.includes("NOT_REDEEMABLE")) {
      return { ok: false, message: "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)" };
    }
    console.error("[credits] ledger_append failed", error);
    return { ok: false, message: "크레딧 기록에 실패했습니다." };
  }
  if (data == null) return { ok: true, id: null, duplicate: true };
  return { ok: true, id: Number(data), duplicate: false };
}

export type LedgerRowLite = { type: string; amount: number; ref_type: string | null };

/** 기프티콘 교환 가능액 = 유료 시트 적립 합 + 교환 관련 차감/환급 합 (레거시·무료 적립은 제외) */
export function redeemableFromRows(rows: ReadonlyArray<LedgerRowLite>): number {
  let total = 0;
  for (const r of rows) {
    // 유료 시트 적립은 타입 무관 합산 — 몰수(penalty/adjust) 도 교환 가능액을 줄인다
    if (
      r.ref_type === PAID_SEAT_LEDGER_REF ||
      r.ref_type === PAID_SEAT_LAUNCH_LEDGER_REF ||
      r.ref_type === REDEMPTION_LEDGER_REF
    ) {
      total += r.amount;
    }
  }
  return Math.max(0, total);
}

/** 교환 가능액 — 유료 시트 적립 기준이되 전체 잔액을 넘지 않는다 */
export async function getRedeemable(supabase: SupabaseClient, userId: number): Promise<number> {
  const { data } = await supabase
    .from("credits_ledger")
    .select("type, amount, ref_type")
    .eq("user_id", userId);
  const rows = (data ?? []) as LedgerRowLite[];
  const balance = rows.reduce((sum, r) => sum + r.amount, 0);
  return Math.max(0, Math.min(redeemableFromRows(rows), balance));
}
