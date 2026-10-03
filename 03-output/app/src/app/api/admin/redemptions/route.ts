import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { REDEMPTION_LEDGER_REF, appendLedger } from "@/lib/credits";
import { createNotification } from "@/lib/notifications";

export const runtime = "edge";

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["done", "reject"]),
  admin_note: z.string().trim().max(200).default(""),
});

/** 기프티콘 교환 처리. done = 수동 발송 완료, reject = 크레딧 환급. 상태 조건부 UPDATE 로 멱등. */
export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  let payload;
  try {
    payload = ActionSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("credit_redemptions")
    .update({
      status: payload.action === "done" ? "done" : "rejected",
      admin_note: payload.admin_note || null,
      processed_by: admin.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .eq("status", "requested")
    .select("id, user_id, amount");

  if (error) {
    console.error("[admin/redemptions] update failed", error);
    return NextResponse.json({ ok: false, message: "갱신에 실패했습니다." }, { status: 500 });
  }
  const row = data?.[0];
  if (!row) {
    return NextResponse.json(
      { ok: false, message: "이미 처리된 신청입니다." },
      { status: 409 },
    );
  }

  if (payload.action === "reject") {
    await appendLedger(supabase, {
      userId: row.user_id,
      amount: row.amount,
      type: "refund",
      refType: REDEMPTION_LEDGER_REF,
      refId: row.id,
      description: `기프티콘 교환 거절 환급${payload.admin_note ? ` — ${payload.admin_note}` : ""}`,
    });
  }

  await createNotification({
    userId: row.user_id,
    type: "redemption_done",
    title: payload.action === "done" ? "🎁 기프티콘이 발송되었습니다" : "기프티콘 교환이 거절되었습니다",
    body:
      payload.action === "done"
        ? `${row.amount.toLocaleString("ko-KR")} 크레딧 교환분을 신청하신 연락처로 보냈습니다.${payload.admin_note ? ` ${payload.admin_note}` : ""}`
        : `${row.amount.toLocaleString("ko-KR")} 크레딧이 환급되었습니다.${payload.admin_note ? ` 사유: ${payload.admin_note}` : ""}`,
    link: "/credits",
  });

  return NextResponse.json({ ok: true });
}
