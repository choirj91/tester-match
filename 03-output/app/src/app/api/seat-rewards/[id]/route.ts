import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DISPUTE_REASON_MIN,
  disputeSeatReward,
  releaseSeatReward,
} from "@/lib/seat-rewards";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({
    action: z.literal("dispute"),
    category: z.enum(["not_my_app", "duplicate", "prohibited"], {
      errorMap: () => ({ message: "이의 사유 분류를 선택해주세요." }),
    }),
    reason: z
      .string()
      .trim()
      .min(DISPUTE_REASON_MIN, `이의 사유를 ${DISPUTE_REASON_MIN}자 이상 구체적으로 적어주세요.`)
      .max(500),
  }),
]);

/** 구매자의 시트 보상 확정/이의 제기 (ADR-0012 부록 A). 해당 주문의 구매자 또는 관리자만. */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const rewardId = Number(id);
  if (!Number.isInteger(rewardId) || rewardId <= 0) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  let payload;
  try {
    payload = BodySchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: reward } = await supabase
    .from("seat_rewards")
    .select("id, paid_tester_orders(buyer_user_id)")
    .eq("id", rewardId)
    .maybeSingle<{ id: number; paid_tester_orders: { buyer_user_id: number } | null }>();
  if (!reward) {
    return NextResponse.json({ ok: false, message: "보상 내역을 찾을 수 없습니다." }, { status: 404 });
  }
  const isBuyer = reward.paid_tester_orders?.buyer_user_id === user.id;
  const isAdmin = user.role === "admin";
  if (!isBuyer && !isAdmin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const result =
    payload.action === "confirm"
      ? await releaseSeatReward(supabase, rewardId, isBuyer ? "buyer" : "admin")
      : await disputeSeatReward(supabase, rewardId, payload.category, payload.reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
