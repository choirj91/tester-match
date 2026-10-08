import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { REDEMPTION_LEDGER_REF, appendLedger, getRedeemable } from "@/lib/credits";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { redemptionRequestedEmail } from "@/lib/email-templates";
import { quoteRedemption, rewardItemSummary, rewardLedgerDescription } from "@/lib/rewards";
import { CONTACT_EMAIL } from "@/lib/site";
import { RedemptionCreateSchema } from "@/lib/validators/redemption";
import { runAfterResponse } from "@/lib/wait-until";

/** 발송 후 연락처는 마스킹되므로, 계정 간 중복 검사는 해시로 한다 */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 보상 교환 신청 — 카탈로그 상품 1종 × 수량 (ADR-0012, ADR-0017, ADR-0020).
 * 차감 크레딧은 서버가 상품 코드로 계산한다 (클라이언트가 보낸 금액은 무시). 원장 선차감 후 신청 레코드.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload;
  try {
    payload = RedemptionCreateSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const quote = quoteRedemption(payload.item_code, payload.quantity);
  if (!quote.ok) {
    return NextResponse.json({ ok: false, message: quote.message }, { status: 400 });
  }
  const { item, quantity, total } = quote;

  const supabase = createSupabaseAdminClient();
  // 한 사람이 여러 계정으로 교환하는 것을 막는다 — 같은 번호는 한 계정에서만
  const contact = payload.contact.replace(/-/g, "");
  const contactHash = await sha256Hex(contact);
  const { count: usedElsewhere } = await supabase
    .from("credit_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("contact_hash", contactHash)
    .neq("user_id", user.id);
  if ((usedElsewhere ?? 0) > 0) {
    return NextResponse.json(
      { ok: false, message: "다른 계정에서 이미 사용된 연락처입니다. 문의가 필요하면 운영팀에 메일 주세요." },
      { status: 409 },
    );
  }

  // 처리 대기 신청은 1건 — 미리 막아 차감·복구 행이 쌓이지 않게 한다 (동시 요청은 DB 부분 unique 가 막는다)
  const { count: pending } = await supabase
    .from("credit_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "requested");
  if ((pending ?? 0) > 0) {
    return NextResponse.json({ ok: false, message: "이미 처리 대기 중인 교환 신청이 있습니다." }, { status: 409 });
  }

  const redeemable = await getRedeemable(supabase, user.id);
  if (redeemable < total) {
    return NextResponse.json(
      { ok: false, message: "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)" },
      { status: 409 },
    );
  }

  const ledger = await appendLedger(supabase, {
    userId: user.id,
    amount: -total,
    type: "spend",
    refType: REDEMPTION_LEDGER_REF,
    description: rewardLedgerDescription(item, quantity),
    capRedeemable: true,
  });
  if (!ledger.ok) {
    return NextResponse.json({ ok: false, message: ledger.message }, { status: 409 });
  }

  const { data: redemption, error } = await supabase
    .from("credit_redemptions")
    .insert({
      user_id: user.id,
      kind: item.kind,
      item_code: item.code,
      quantity,
      amount: total,
      contact,
      contact_hash: contactHash,
      note: payload.note,
      ledger_id: ledger.id,
    })
    .select("id")
    .single();
  if (error || !redemption) {
    console.error("[redemptions/POST] insert failed", error);
    const refund = await appendLedger(supabase, {
      userId: user.id,
      amount: total,
      type: "refund",
      refType: REDEMPTION_LEDGER_REF,
      description: "교환 신청 실패 복구",
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
    rewardLabel: rewardItemSummary(item, quantity),
    amount: total,
    contact,
    note: payload.note,
  });
  await runAfterResponse(sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...tmpl }));

  return NextResponse.json({ ok: true, id: redemption.id });
}
