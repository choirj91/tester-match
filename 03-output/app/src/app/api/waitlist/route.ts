import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const Body = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: Request) {
  let payload: z.infer<typeof Body>;
  try {
    payload = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, message: "올바른 이메일을 입력해주세요." },
      { status: 400 },
    );
  }

  // TODO(week-2): Supabase `waitlist_signups` 테이블에 INSERT.
  // 현재는 로그만 남기고 성공 응답. PII는 프로덕션에서 마스킹 필수.
  console.log("[waitlist] signup", { email: payload.email, ts: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
