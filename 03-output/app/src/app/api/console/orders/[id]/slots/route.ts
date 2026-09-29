import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOrderSlots } from "@/lib/console-data";

export const runtime = "edge";

function parseOrderId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 관리자: tester_count 만큼 슬롯 생성 (멱등) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  const orderId = parseOrderId((await params).id);
  if (!orderId) return NextResponse.json({ ok: false, message: "잘못된 주문" }, { status: 400 });

  const count = await ensureOrderSlots(orderId);
  return NextResponse.json({ ok: true, count });
}

const LabelSchema = z.object({
  slot_id: z.coerce.number().int().positive(),
  label: z.string().trim().min(1, "라벨을 입력해주세요.").max(40),
});

/** 관리자: 슬롯 라벨(운영 계정명) 변경 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  const orderId = parseOrderId((await params).id);
  if (!orderId) return NextResponse.json({ ok: false, message: "잘못된 주문" }, { status: 400 });

  const parsed = LabelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "잘못된 입력" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("paid_order_slots")
    .update({ label: parsed.data.label })
    .eq("id", parsed.data.slot_id)
    .eq("order_id", orderId)
    .select("id");
  if (error || !data || data.length === 0) {
    return NextResponse.json({ ok: false, message: "슬롯을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
