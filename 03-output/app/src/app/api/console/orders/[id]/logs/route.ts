import { screenshotStore } from "@/lib/screenshot-store";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CONSOLE_TOTAL_DAYS,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MIME_TO_EXT,
  screenshotObjectPath,
} from "@/lib/console";

const FieldsSchema = z.object({
  slot_id: z.coerce.number().int().positive(),
  day_n: z.coerce.number().int().min(1).max(CONSOLE_TOTAL_DAYS),
  status: z.enum(["done", "missed"]),
  comment: z.string().trim().max(2000).default(""),
});

/** 관리자: 슬롯×일차 로그 기록 (스크린샷은 선택, 있으면 교체) */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ ok: false, message: "잘못된 주문" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "잘못된 요청 형식" }, { status: 400 });
  }
  const parsed = FieldsSchema.safeParse({
    slot_id: form.get("slot_id"),
    day_n: form.get("day_n"),
    status: form.get("status"),
    comment: form.get("comment") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "잘못된 입력" },
      { status: 400 },
    );
  }
  const fields = parsed.data;

  const supabase = createSupabaseAdminClient();
  const { data: slot } = await supabase
    .from("paid_order_slots")
    .select("id, slot_no, order_id")
    .eq("id", fields.slot_id)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!slot) {
    return NextResponse.json({ ok: false, message: "슬롯을 찾을 수 없습니다." }, { status: 404 });
  }

  const file = form.get("screenshot");
  let screenshotPath: string | undefined;
  if (file instanceof File && file.size > 0) {
    const ext = SCREENSHOT_MIME_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { ok: false, message: "PNG · JPEG · WebP 이미지만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    if (file.size > SCREENSHOT_MAX_BYTES) {
      return NextResponse.json({ ok: false, message: "이미지는 5MB 이하여야 합니다." }, { status: 400 });
    }
    screenshotPath = screenshotObjectPath(orderId, slot.slot_no, fields.day_n, ext);
    const { error: uploadErr } = await screenshotStore(supabase).upload(screenshotPath, file, file.type);
    if (uploadErr) {
      console.error("[console/logs] upload failed", uploadErr);
      return NextResponse.json({ ok: false, message: "스크린샷 업로드 실패" }, { status: 500 });
    }
  }

  // 새 스크린샷이 없으면 screenshot_path 를 payload 에서 빼서 기존 값을 유지한다.
  const { error } = await supabase.from("paid_order_logs").upsert(
    {
      order_id: orderId,
      slot_id: slot.id,
      day_n: fields.day_n,
      status: fields.status,
      comment: fields.comment,
      logged_by: admin.id,
      updated_at: new Date().toISOString(),
      ...(screenshotPath ? { screenshot_path: screenshotPath } : {}),
    },
    { onConflict: "slot_id,day_n" },
  );
  if (error) {
    console.error("[console/logs] upsert failed", error);
    return NextResponse.json({ ok: false, message: "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, screenshot_path: screenshotPath ?? null });
}
