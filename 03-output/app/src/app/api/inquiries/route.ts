import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { announceInquiry, createInquiry } from "@/lib/inquiries";
import { isSameOriginRequest } from "@/lib/signup-confirm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InquiryCreateSchema } from "@/lib/validators/inquiry";
import { runAfterResponse } from "@/lib/wait-until";

/** 1:1 문의 접수 — 로그인 회원만. 저장 후 운영팀 Slack 으로 알린다. */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req.url, req.headers)) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload;
  try {
    payload = InquiryCreateSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const result = await createInquiry(supabase, { id: user.id }, payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
  // Slack 이 느려도 접수 응답을 붙잡지 않는다 — 응답 뒤에 알리고 전송 시각을 기록한다
  await runAfterResponse(
    announceInquiry(supabase, result.id, { id: user.id, nickname: user.nickname }, payload),
  );
  return NextResponse.json({ ok: true, id: result.id });
}
