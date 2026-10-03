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
/** 기프티콘 교환 차감/환급 */
export const REDEMPTION_LEDGER_REF = "redemption";

export type AppendLedgerArgs = {
  userId: number;
  amount: number;
  type: LedgerType;
  refType?: string;
  refId?: number | null;
  description?: string;
};

export type AppendLedgerResult =
  | { ok: true; id: number; balanceAfter: number }
  | { ok: false; message: string };

/**
 * 원장 append (balance_after 는 코드에서 합산 — 저볼륨 전제, 동시 쓰기 경합 시 잔액 표기만 어긋남).
 * 음수 금액(spend 등)은 잔액 부족이면 거부한다.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  args: AppendLedgerArgs,
): Promise<AppendLedgerResult> {
  const balance = await getBalance(supabase, args.userId);
  const balanceAfter = balance + args.amount;
  if (args.amount < 0 && balanceAfter < 0) {
    return { ok: false, message: "크레딧 잔액이 부족합니다." };
  }
  const { data, error } = await supabase
    .from("credits_ledger")
    .insert({
      user_id: args.userId,
      amount: args.amount,
      balance_after: balanceAfter,
      type: args.type,
      ref_type: args.refType ?? null,
      ref_id: args.refId ?? null,
      description: args.description ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[credits] ledger insert failed", error);
    return { ok: false, message: "크레딧 기록에 실패했습니다." };
  }
  return { ok: true, id: data.id, balanceAfter };
}

export type LedgerRowLite = { type: string; amount: number; ref_type: string | null };

/** 기프티콘 교환 가능액 = 유료 시트 적립 합 + 교환 관련 차감/환급 합 (레거시·무료 적립은 제외) */
export function redeemableFromRows(rows: ReadonlyArray<LedgerRowLite>): number {
  let total = 0;
  for (const r of rows) {
    if (r.ref_type === PAID_SEAT_LEDGER_REF && r.type === "earn") total += r.amount;
    else if (r.ref_type === REDEMPTION_LEDGER_REF) total += r.amount;
  }
  return Math.max(0, total);
}

export async function getRedeemable(supabase: SupabaseClient, userId: number): Promise<number> {
  const { data } = await supabase
    .from("credits_ledger")
    .select("type, amount, ref_type")
    .eq("user_id", userId)
    .in("ref_type", [PAID_SEAT_LEDGER_REF, REDEMPTION_LEDGER_REF]);
  return redeemableFromRows((data ?? []) as LedgerRowLite[]);
}
