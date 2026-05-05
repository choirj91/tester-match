import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MatchOptOutSchema } from "@/lib/validators/match";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/matches/[id]
 * body: { reason?: string }
 * 본인이 tester 인 active 매칭을 opted_out 으로 전환 + apps.required_testers + 1.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  let payload;
  try {
    const body = await req.json().catch(() => ({}));
    payload = MatchOptOutSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, app_id, tester_user_id, status")
    .eq("id", matchId)
    .maybeSingle();

  if (matchErr || !match) {
    return NextResponse.json(
      { ok: false, message: "매칭을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (match.tester_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  if (match.status !== "active") {
    return NextResponse.json(
      { ok: false, message: "활성 매칭이 아닙니다." },
      { status: 409 },
    );
  }

  // 옵트아웃 처리
  const { error: updErr } = await supabase
    .from("matches")
    .update({
      status: "opted_out",
      opted_out_at: new Date().toISOString(),
      opt_out_reason: payload.reason ?? null,
    })
    .eq("id", matchId);

  if (updErr) {
    console.error("[matches/PATCH] update failed", updErr);
    return NextResponse.json({ ok: false, message: "옵트아웃 실패" }, { status: 500 });
  }

  // required_testers 복구 (best-effort)
  const { data: app } = await supabase
    .from("apps")
    .select("required_testers, status")
    .eq("id", match.app_id)
    .maybeSingle();
  if (app) {
    await supabase
      .from("apps")
      .update({ required_testers: app.required_testers + 1 })
      .eq("id", match.app_id);
  }

  return NextResponse.json({ ok: true });
}
