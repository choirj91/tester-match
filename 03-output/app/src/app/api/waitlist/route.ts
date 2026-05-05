import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

const Body = z.object({
  email: z.string().email().max(254),
});

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = req.headers.get("user-agent");
  const referer = req.headers.get("referer");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email: payload.email,
    source: referer,
    user_agent: userAgent,
    ip_hash: await hashIp(ip),
  });

  // 23505 = unique_violation. 동일 이메일 재등록은 사용자에게 성공으로 응답.
  if (error && error.code !== "23505") {
    console.error("[waitlist] insert failed", { code: error.code, message: error.message });
    return NextResponse.json(
      { ok: false, message: "잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
