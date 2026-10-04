import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { confirmPaidTesterOrder } from "@/lib/paid-orders";
import { extractPaidOrderCode } from "@/lib/paid-testers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PrecheckState = "payable" | "paid" | "closed";

const RETRY_MESSAGE = "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
const NOT_FOUND_MESSAGE = "주문을 찾을 수 없습니다.";

/**
 * 결제창을 열기 전 확인 (구매자 본인만) — 이미 결제된 주문에 결제창을 다시 열거나 취소된 주문에 결제하는 일을 막는다.
 * 주문 확정(confirmPaidTesterOrder)을 그대로 돌린다: 포트원에 결제가 있으면 여기서 바로 반영된다.
 *   payable: 아직 미결제이고, 포트원에 결제가 없거나 다시 시도해도 되는 상태(READY·FAILED)다 → 결제창을 열어도 된다
 *   paid   : 이미 결제·확정됨 → 성공 화면으로
 *   closed : 결제할 수 없는 주문 (취소·환불, 운영자 확인 대기, 이전 결제 시도가 끝나지 않음) → message 안내
 * 결제 여부를 확인할 수 없으면 500 (502·503 은 Cloudflare 가 본문을 바꾼다) — 결제창을 열지 않고 다시 시도하게 한다.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { code } = await params;
  const orderCode = extractPaidOrderCode(code);
  if (!orderCode || orderCode !== code) {
    return NextResponse.json({ message: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  const { data: order, error } = await createSupabaseAdminClient()
    .from("paid_tester_orders")
    .select("buyer_user_id")
    .eq("order_code", orderCode)
    .maybeSingle<{ buyer_user_id: number }>();
  if (error) {
    console.error("[paid-testers/precheck] order load failed", error);
    return NextResponse.json({ message: RETRY_MESSAGE }, { status: 500 });
  }
  if (!order || order.buyer_user_id !== user.id) {
    return NextResponse.json({ message: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  const result = await confirmPaidTesterOrder({ orderId: orderCode });
  if (result.ok) return NextResponse.json({ state: "paid" satisfies PrecheckState });
  if (result.reason === "not_paid") return NextResponse.json({ state: "payable" satisfies PrecheckState });
  if (result.reason === "retry") return NextResponse.json({ message: RETRY_MESSAGE }, { status: 500 });
  return NextResponse.json({ state: "closed" satisfies PrecheckState, message: result.message });
}
