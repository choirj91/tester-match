import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { redemptionRequestedEmail } from "@/lib/email-templates";
import {
  REDEMPTION_CREATE_ERROR_RESPONSE,
  dbErrorLog,
  parseRedemptionCreateResult,
  redemptionRpcFailure,
} from "@/lib/redemptions";
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
 * 차감 크레딧은 서버가 상품 코드로 계산한다 (클라이언트가 보낸 금액은 무시).
 * 대기 1건·교환 가능액·번호 중복 검사와 신청·차감은 DB 함수 redemption_create 가 한 트랜잭션으로 한다.
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

  // 한 사람이 여러 계정으로 교환하는 것을 막는다 — 같은 번호는 한 계정에서만 (검사는 DB 함수 안)
  const contact = payload.contact.replace(/-/g, "");
  const contactHash = await sha256Hex(contact);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("redemption_create", {
    p_user: user.id,
    p_item_code: item.code,
    p_quantity: quantity,
    p_amount: total,
    p_kind: item.kind,
    p_contact: contact,
    p_contact_hash: contactHash,
    p_note: payload.note,
    p_description: rewardLedgerDescription(item, quantity),
  });
  if (error) {
    console.error("[redemptions/POST] redemption_create failed", dbErrorLog(error));
    const failure = redemptionRpcFailure(error);
    return NextResponse.json({ ok: false, message: failure.message }, { status: failure.status });
  }

  const result = parseRedemptionCreateResult(data);
  if (result.kind === "error") {
    const failure = REDEMPTION_CREATE_ERROR_RESPONSE[result.code];
    return NextResponse.json({ ok: false, message: failure.message }, { status: failure.status });
  }
  if (result.kind === "unknown") {
    console.error("[redemptions/POST] unexpected redemption_create result");
    return NextResponse.json({ ok: false, message: "신청에 실패했습니다." }, { status: 500 });
  }

  const tmpl = redemptionRequestedEmail({
    redemptionId: result.id,
    nickname: user.nickname,
    email: user.email,
    rewardLabel: rewardItemSummary(item, quantity),
    amount: total,
    contact,
    note: payload.note,
  });
  await runAfterResponse(sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...tmpl }));

  return NextResponse.json({ ok: true, id: result.id });
}
