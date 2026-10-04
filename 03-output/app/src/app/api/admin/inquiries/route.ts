import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { answerInquiry, setInquiryMemo, setInquiryStatus } from "@/lib/inquiries";
import { isSameOriginRequest } from "@/lib/signup-confirm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InquiryAdminActionSchema } from "@/lib/validators/inquiry";

export const runtime = "edge";

/** 문의 처리 — 답변 등록(작성자에게 알림·메일), 상태 변경, 내부 메모. 관리자만. */
export async function PATCH(req: Request) {
  if (!isSameOriginRequest(req.url, req.headers)) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 403 });
  }
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  let payload;
  try {
    payload = InquiryAdminActionSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (payload.action === "answer") {
    const answered = await answerInquiry(supabase, admin.id, payload.id, payload.answer);
    if (!answered.ok) {
      return NextResponse.json({ ok: false, message: answered.message }, { status: answered.status });
    }
    return NextResponse.json({ ok: true, emailSent: answered.emailSent });
  }

  const result =
    payload.action === "status"
      ? await setInquiryStatus(supabase, payload.id, payload.status)
      : await setInquiryMemo(supabase, payload.id, payload.memo);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
