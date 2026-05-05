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
