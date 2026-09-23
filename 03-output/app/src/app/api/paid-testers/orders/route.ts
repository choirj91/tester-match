import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PaidOrderCreateSchema } from "@/lib/validators/paid-order";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { newPaidOrderCode, paidTesterAmountKrw } from "@/lib/paid-testers";

export const runtime = "edge";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload;
  try {
    payload = PaidOrderCreateSchema.parse(await req.json());
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
  if (app.status === "deleted") {
    return NextResponse.json(
      { ok: false, message: "삭제된 앱에는 신청할 수 없습니다." },
      { status: 409 },
    );
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
    return NextResponse.json(
      { ok: false, message: "주문 생성에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, order_code: orderCode });
}
