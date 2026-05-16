import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * POST /api/track
 * 클라이언트에서 호출 — localStorage session_id 기반 일별 방문자 집계.
 * 같은 기기+날짜 조합은 unique index 로 중복 무시.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { session_id?: unknown };
    const sessionId = body?.session_id;
    if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 64) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("page_views").insert({ session_id: sessionId });
    // 23505 = unique_violation (같은 날 이미 기록됨) → 정상
    if (error && error.code !== "23505") {
      console.error("[track] insert failed", error.message);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
