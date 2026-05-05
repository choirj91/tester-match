import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MatchOptInSchema } from "@/lib/validators/match";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload;
  try {
    payload = MatchOptInSchema.parse(await req.json());
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

  // 1) 앱 상태 확인 + 본인 앱 차단
  const { data: app, error: appErr } = await supabase
    .from("apps")
    .select("id, owner_user_id, status, required_testers")
    .eq("id", payload.app_id)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ ok: false, message: "앱을 찾을 수 없습니다." }, { status: 404 });
  }
  if (app.status !== "matching") {
    return NextResponse.json(
      { ok: false, message: "현재 매칭 중인 앱이 아닙니다." },
      { status: 409 },
    );
  }
  if (app.owner_user_id === user.id) {
    return NextResponse.json(
      { ok: false, message: "본인 앱에는 참여할 수 없습니다." },
      { status: 400 },
    );
  }
  if (app.required_testers <= 0) {
    return NextResponse.json(
      { ok: false, message: "이미 정원이 마감되었습니다." },
      { status: 409 },
    );
  }

  // 2) matches insert. 부분 unique index 가 중복 active 매칭 차단(23505).
  const now = new Date().toISOString();
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .insert({
      app_id: payload.app_id,
      tester_user_id: user.id,
      status: "active",
      matched_at: now,
      opted_in_at: now,
    })
    .select("id")
    .single();

  if (matchErr) {
    if (matchErr.code === "23505") {
      return NextResponse.json(
        { ok: false, message: "이미 참여 중인 매칭입니다." },
        { status: 409 },
      );
    }
    console.error("[matches/POST] insert failed", matchErr);
    return NextResponse.json({ ok: false, message: "참여에 실패했습니다." }, { status: 500 });
  }

  // 3) required_testers decrement (best-effort, 작은 race window 허용 — MVP 수준).
  await supabase
    .from("apps")
    .update({ required_testers: app.required_testers - 1 })
    .eq("id", payload.app_id);

  return NextResponse.json({ ok: true, match_id: match.id });
}
