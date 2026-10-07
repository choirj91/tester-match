import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { REDEMPTION_LEDGER_REF, appendLedger, getRedeemable } from "@/lib/credits";
import {
  REDEMPTION_MAX_CREDITS,
  REDEMPTION_MIN_CREDITS,
  REDEMPTION_UNIT_CREDITS,
} from "@/lib/paid-seats";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { redemptionRequestedEmail } from "@/lib/email-templates";
import { REWARD_CATALOG, REWARD_KINDS, rewardLedgerDescription } from "@/lib/rewards";
import { CONTACT_EMAIL } from "@/lib/site";
import { runAfterResponse } from "@/lib/wait-until";

const BodySchema = z.object({
  kind: z.enum(REWARD_KINDS).default("gifticon"),
  amount: z.coerce
    .number()
    .int()
    .min(REDEMPTION_MIN_CREDITS, `최소 ${REDEMPTION_MIN_CREDITS.toLocaleString("ko-KR")} 크레딧부터 교환할 수 있습니다.`)
    .max(
      REDEMPTION_MAX_CREDITS,
      `한 번에 ${REDEMPTION_MAX_CREDITS.toLocaleString("ko-KR")} 크레딧까지 교환할 수 있습니다.`,
    )
    .refine((v) => v % REDEMPTION_UNIT_CREDITS === 0, {
      message: `${REDEMPTION_UNIT_CREDITS.toLocaleString("ko-KR")} 크레딧 단위로 신청해주세요.`,
    }),
  contact: z
    .string()
    .trim()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "보상을 받을 휴대폰 번호를 입력해주세요 (예: 010-1234-5678)."),
  note: z.string().trim().max(200).default(""),
});

/** 발송 후 연락처는 마스킹되므로, 계정 간 중복 검사는 해시로 한다 */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 보상 교환 신청(기프티콘·네이버페이 포인트) — 원장 선차감 후 신청 레코드 (ADR-0012, ADR-0017). */
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
    description: rewardLedgerDescription(payload.kind),
    capRedeemable: true,
  });
  if (!ledger.ok) {
    return NextResponse.json({ ok: false, message: ledger.message }, { status: 409 });
  }

  const { data: redemption, error } = await supabase
    .from("credit_redemptions")
    .insert({
      user_id: user.id,
      kind: payload.kind,
      amount: payload.amount,
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
      amount: payload.amount,
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
    kindLabel: REWARD_CATALOG[payload.kind].label,
    amount: payload.amount,
    contact,
    note: payload.note,
  });
  await runAfterResponse(sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...tmpl }));

  return NextResponse.json({ ok: true, id: redemption.id });
}
