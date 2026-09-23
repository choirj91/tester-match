import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["start", "complete", "cancel"]),
});

/** action → (허용 현재 상태, 다음 상태, 타임스탬프 필드) */
const TRANSITIONS: Record<
  z.infer<typeof ActionSchema>["action"],
  { from: string[]; to: string; stamp?: "started_at" | "completed_at" }
> = {
  start: { from: ["paid"], to: "in_progress", stamp: "started_at" },
  complete: { from: ["in_progress"], to: "completed", stamp: "completed_at" },
  cancel: { from: ["pending", "paid"], to: "canceled" },
};

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

  const transition = TRANSITIONS[payload.action];
  const supabase = createSupabaseAdminClient();

  const update: Record<string, unknown> = { status: transition.to };
  if (transition.stamp) update[transition.stamp] = new Date().toISOString();
  if (payload.action === "cancel") update.admin_note = `관리자 취소 (${admin.nickname})`;

  // 상태 조건부 UPDATE — 잘못된 전이·동시 클릭은 0행 갱신으로 무해하게 끝난다
  const { data, error } = await supabase
    .from("paid_tester_orders")
    .update(update)
    .eq("id", payload.id)
    .in("status", transition.from)
    .select("id, status");

  if (error) {
    console.error("[admin/paid-orders] update failed", error);
    return NextResponse.json({ ok: false, message: "갱신에 실패했습니다." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { ok: false, message: "전이할 수 없는 상태입니다. 새로고침 후 다시 확인해주세요." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: data[0].status });
}
