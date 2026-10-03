import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { PaidOrderCreateSchema } from "@/lib/validators/paid-order";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  canOrderPaidTesters,
  isReviewOrderer,
  newPaidOrderCode,
  paidTesterAmountKrw,
} from "@/lib/paid-testers";
import { createCreditsPaidOrder } from "@/lib/paid-orders";

export const runtime = "edge";

const BodySchema = PaidOrderCreateSchema.extend({
  pay_with: z.enum(["toss", "credits"]).default("toss"),
  agreed: z.boolean().refine((v) => v === true, "구매 전 유의사항에 모두 동의해주세요."),
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
    .select("id, name, owner_user_id, status, store_invite_url, web_invite_url")
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
  const reviewOrder = isReviewOrderer(user);
  if (app.status !== "matching" && !reviewOrder) {
    return NextResponse.json(
      { ok: false, message: "매칭 중 상태의 앱만 신청할 수 있습니다." },
      { status: 409 },
    );
  }

  // 초대 링크가 없으면 테스터가 설치할 방법이 없다 — 돈을 받기 전에 막는다
  if (!app.store_invite_url && !app.web_invite_url) {
    return NextResponse.json(
      {
        ok: false,
        message: "앱에 테스트 초대 링크가 없습니다. 내 앱 → 수정에서 초대 링크를 먼저 등록해주세요.",
      },
      { status: 409 },
    );
  }

  // 응답 유실 후 재시도·더블클릭으로 같은 주문이 두 번 결제되는 것을 막는다
  const { count: recentSame } = await supabase
    .from("paid_tester_orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_user_id", user.id)
    .eq("app_id", app.id)
    .eq("tester_count", payload.tester_count)
    .in("status", ["paid", "in_progress"])
    .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString());
  if ((recentSame ?? 0) > 0) {
    return NextResponse.json(
      { ok: false, message: "방금 같은 주문이 접수되었습니다. 콘솔에서 확인해주세요." },
      { status: 409 },
    );
  }

  const consentedAt = new Date().toISOString();

  if (payload.pay_with === "credits") {
    const result = await createCreditsPaidOrder({
      buyer: { id: user.id, nickname: user.nickname },
      app: { id: app.id, name: app.name },
      testerCount: payload.tester_count,
      consentedAt,
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
    consented_at: consentedAt,
    // 심사·시험용 주문은 시트를 열지 않는다 (결제 확정 시 급구·알림도 건너뜀)
    seats_closed: reviewOrder,
    // 시트가 없는 주문은 자동 종결 대상이 아니다 — 운영자가 직접 완료·취소(환불)한다
    fulfillment: reviewOrder ? "operator" : "community",
  });

  if (insertErr) {
    console.error("[paid-testers/orders] insert failed", insertErr);
    return NextResponse.json({ ok: false, message: "주문 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order_code: orderCode, paid: false });
}
