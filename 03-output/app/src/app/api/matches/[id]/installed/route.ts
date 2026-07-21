import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * POST /api/matches/[id]/installed — 테스터 본인의 설치 자가확인.
 * 멱등: 이미 확인된 경우 시각 유지.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, tester_user_id, status, installed_at")
    .eq("id", matchId)
    .maybeSingle();

  if (!match || match.tester_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "매칭을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!["pending", "active"].includes(match.status)) {
    return NextResponse.json(
      { ok: false, message: "진행 중인 매칭이 아닙니다." },
      { status: 409 },
    );
  }

  if (!match.installed_at) {
    await supabase
      .from("matches")
      .update({ installed_at: new Date().toISOString() })
      .eq("id", matchId)
      .is("installed_at", null);
  }

  return NextResponse.json({ ok: true });
}
