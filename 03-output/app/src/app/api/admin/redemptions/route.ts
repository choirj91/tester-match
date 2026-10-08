import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { dbErrorLog, maskContact, parseRedemptionRejectResult } from "@/lib/redemptions";
import { redemptionLabel } from "@/lib/rewards";

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["done", "reject"]),
  admin_note: z.string().trim().max(200).default(""),
});

const ROW_COLUMNS = "id, user_id, amount, contact, kind, item_code, quantity";

type ProcessedRow = {
  id: number;
  user_id: number;
  amount: number;
  contact: string;
  kind: string;
  item_code: string | null;
  quantity: number | null;
};

function alreadyProcessed() {
  return NextResponse.json({ ok: false, message: "이미 처리된 신청입니다." }, { status: 409 });
}

function updateFailed() {
  return NextResponse.json({ ok: false, message: "갱신에 실패했습니다." }, { status: 500 });
}

/**
 * 보상 교환 처리. done = 수동 발송 완료(상태 조건부 UPDATE + 연락처 마스킹),
 * reject = DB 함수 redemption_reject 한 번으로 상태 변경·연락처 마스킹·크레딧 복구 (ADR-0020). 둘 다 멱등.
 */
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

  if (payload.action === "done" && payload.admin_note.length < 5) {
    return NextResponse.json(
      { ok: false, message: "발송 내역(브랜드·금액·주문번호 등)을 5자 이상 적어주세요 — 발송 증빙입니다." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  let row: ProcessedRow;

  if (payload.action === "reject") {
    const { data, error } = await supabase.rpc("redemption_reject", {
      p_id: payload.id,
      p_admin: admin.id,
      p_note: payload.admin_note,
    });
    if (error) {
      console.error("[admin/redemptions] redemption_reject failed", dbErrorLog(error));
      return updateFailed();
    }
    const result = parseRedemptionRejectResult(data);
    if (result === "already") return alreadyProcessed();
    if (result === "unknown") {
      console.error("[admin/redemptions] unexpected redemption_reject result");
      return updateFailed();
    }
    // 거절·복구는 끝났다. 알림 문구에 쓸 상품·금액만 읽는다
    const { data: read, error: readError } = await supabase
      .from("credit_redemptions")
      .select(ROW_COLUMNS)
      .eq("id", payload.id)
      .maybeSingle();
    if (readError || !read) {
      if (readError) console.error("[admin/redemptions] read after reject failed", dbErrorLog(readError));
      return NextResponse.json({ ok: true });
    }
    row = read as ProcessedRow;
  } else {
    const { data, error } = await supabase
      .from("credit_redemptions")
      .update({
        status: "done",
        admin_note: payload.admin_note || null,
        processed_by: admin.id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", payload.id)
      .eq("status", "requested")
      .select(ROW_COLUMNS);
    if (error) {
      console.error("[admin/redemptions] update failed", dbErrorLog(error));
      return updateFailed();
    }
    const updated = data?.[0] as ProcessedRow | undefined;
    if (!updated) return alreadyProcessed();
    row = updated;

    // 발송이 끝난 연락처는 뒤 4자리만 남긴다 (계정 간 중복 검사는 contact_hash 로 한다)
    const masked = maskContact(row.contact);
    if (masked !== row.contact) {
      const { error: maskError } = await supabase
        .from("credit_redemptions")
        .update({ contact: masked })
        .eq("id", row.id);
      if (maskError) console.error("[admin/redemptions] contact mask failed", dbErrorLog(maskError));
    }
  }

  const label = redemptionLabel(row);
  await createNotification({
    userId: row.user_id,
    type: "redemption_done",
    title: payload.action === "done" ? "보상 교환 상품을 보냈습니다" : "보상 교환 신청이 거절되었습니다",
    body:
      payload.action === "done"
        ? `${label}(${row.amount.toLocaleString("ko-KR")} 크레딧)을 신청하신 연락처로 보냈습니다.${payload.admin_note ? ` ${payload.admin_note}` : ""}`
        : `${label} 신청의 ${row.amount.toLocaleString("ko-KR")} 크레딧을 되돌렸습니다.${payload.admin_note ? ` 사유: ${payload.admin_note}` : ""}`,
    link: "/credits",
  });

  return NextResponse.json({ ok: true });
}
