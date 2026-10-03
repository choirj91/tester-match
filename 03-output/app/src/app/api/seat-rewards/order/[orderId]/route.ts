import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { releaseSeatReward } from "@/lib/seat-rewards";

export const runtime = "edge";

type Ctx = { params: Promise<{ orderId: string }> };

const CONFIRM_PER_CALL = 6;

/** 주문의 확정 대기 보상 전체 확정 — 구매자 "완료" 버튼 (ADR-0012 부록 A). */
export async function POST(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { orderId: raw } = await params;
  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("id, buyer_user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: false, message: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  const isBuyer = order.buyer_user_id === user.id;
  if (!isBuyer && user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  // 한 요청에 다 처리할 수 없다 (요청당 처리량 상한) — 몇 건씩 확정하고 남은 수를 돌려준다
  const { data: held, count } = await supabase
    .from("seat_rewards")
    .select("id", { count: "exact" })
    .eq("order_id", orderId)
    .eq("status", "held")
    .order("id", { ascending: true })
    .limit(CONFIRM_PER_CALL);
  let released = 0;
  for (const r of held ?? []) {
    const result = await releaseSeatReward(supabase, r.id, isBuyer ? "buyer" : "admin");
    if (result.ok) released++;
  }
  const remaining = Math.max(0, (count ?? 0) - released);
  return NextResponse.json({ ok: true, released, remaining });
}
