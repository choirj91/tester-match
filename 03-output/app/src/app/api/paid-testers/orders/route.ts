import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { PaidOrderCreateSchema } from "@/lib/validators/paid-order";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  canOrderPaidTesters,
  newPaidOrderCode,
  paidTesterAmountKrw,
} from "@/lib/paid-testers";
import { createCreditsPaidOrder } from "@/lib/paid-orders";

export const runtime = "edge";

const BodySchema = PaidOrderCreateSchema.extend({
  pay_with: z.enum(["toss", "credits"]).default("toss"),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!canOrderPaidTesters(user)) {
    return NextResponse.json(
      { ok: false, message: "유료 테스터는 아직 오픈 전입니다." },
      { status: 403 },
    );
  }

  let payload;
  try {
    payload = BodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: app, error: appErr } = await supabase
    .from("apps")
    .select("id, name, owner_user_id, status")
    .eq("id", payload.app_id)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ ok: false, message: "앱을 찾을 수 없습니다." }, { status: 404 });
  }
  if (app.owner_user_id !== user.id) {
    return NextResponse.json(
      { ok: false, message: "본인이 등록한 앱만 신청할 수 있습니다." },
      { status: 403 },
    );
  }
  if (app.status !== "matching") {
    return NextResponse.json(
      { ok: false, message: "매칭 중 상태의 앱만 신청할 수 있습니다." },
      { status: 409 },
    );
  }

  if (payload.pay_with === "credits") {
    const result = await createCreditsPaidOrder({
      buyer: { id: user.id, nickname: user.nickname },
      app: { id: app.id, name: app.name },
      testerCount: payload.tester_count,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true, order_code: result.orderCode, paid: true });
  }

  const orderCode = newPaidOrderCode();
  const { error: insertErr } = await supabase.from("paid_tester_orders").insert({
    order_code: orderCode,
    app_id: app.id,
    buyer_user_id: user.id,
    tester_count: payload.tester_count,
    amount_krw: paidTesterAmountKrw(payload.tester_count),
  });

  if (insertErr) {
    console.error("[paid-testers/orders] insert failed", insertErr);
    return NextResponse.json({ ok: false, message: "주문 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order_code: orderCode, paid: false });
}
