import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { REDEMPTION_LEDGER_REF, appendLedger, getRedeemable } from "@/lib/credits";
import { REDEMPTION_MIN_CREDITS, REDEMPTION_UNIT_CREDITS } from "@/lib/paid-seats";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { redemptionRequestedEmail } from "@/lib/email-templates";
import { CONTACT_EMAIL } from "@/lib/site";
import { runAfterResponse } from "@/lib/wait-until";

export const runtime = "edge";

const BodySchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .min(REDEMPTION_MIN_CREDITS, `최소 ${REDEMPTION_MIN_CREDITS.toLocaleString("ko-KR")} 크레딧부터 교환할 수 있습니다.`)
    .refine((v) => v % REDEMPTION_UNIT_CREDITS === 0, {
      message: `${REDEMPTION_UNIT_CREDITS.toLocaleString("ko-KR")} 크레딧 단위로 신청해주세요.`,
    }),
  contact: z.string().trim().min(5, "연락처를 입력해주세요.").max(80),
  note: z.string().trim().max(200).default(""),
});

/** 기프티콘 교환 신청 — 원장 선차감 후 신청 레코드 (ADR-0012). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
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
  const redeemable = await getRedeemable(supabase, user.id);
  if (redeemable < payload.amount) {
    return NextResponse.json(
      { ok: false, message: "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)" },
      { status: 409 },
    );
  }

  const ledger = await appendLedger(supabase, {
    userId: user.id,
    amount: -payload.amount,
    type: "spend",
    refType: REDEMPTION_LEDGER_REF,
    description: "기프티콘 교환 신청",
    capRedeemable: true,
  });
  if (!ledger.ok) {
    return NextResponse.json({ ok: false, message: ledger.message }, { status: 409 });
  }

  const { data: redemption, error } = await supabase
    .from("credit_redemptions")
    .insert({
      user_id: user.id,
      amount: payload.amount,
      contact: payload.contact,
      note: payload.note,
      ledger_id: ledger.id,
    })
    .select("id")
    .single();
  if (error || !redemption) {
    console.error("[redemptions/POST] insert failed", error);
    const refund = await appendLedger(supabase, {
      userId: user.id,
      amount: payload.amount,
      type: "refund",
      refType: REDEMPTION_LEDGER_REF,
      description: "교환 신청 실패 환급",
    });
    if (!refund.ok) console.error("[redemptions/POST] refund after failure failed", refund.message);
    const message =
      error?.code === "23505"
        ? "이미 처리 대기 중인 교환 신청이 있습니다."
        : "신청에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status: error?.code === "23505" ? 409 : 500 });
  }

  const tmpl = redemptionRequestedEmail({
    redemptionId: redemption.id,
    nickname: user.nickname,
    email: user.email,
    amount: payload.amount,
    contact: payload.contact,
    note: payload.note,
  });
  await runAfterResponse(sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...tmpl }));

  return NextResponse.json({ ok: true, id: redemption.id });
}
