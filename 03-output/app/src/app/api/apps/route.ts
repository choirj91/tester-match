import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppCreateSchema } from "@/lib/validators/app";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  let payload;
  try {
    payload = AppCreateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // 닉네임 변경 시 users 갱신 (보호 트리거가 role/trust_score/status 는 차단).
  if (payload.nickname !== user.nickname) {
    const { error: nickErr } = await supabase
      .from("users")
      .update({ nickname: payload.nickname })
      .eq("id", user.id);
    if (nickErr) {
      console.error("[apps/POST] nickname update failed", nickErr);
    }
  }

  // 앱 INSERT — RLS 정책이 owner_user_id = current_app_user_id() 검증.
  const { data, error } = await supabase
    .from("apps")
    .insert({
      owner_user_id: user.id,
      name: payload.name,
      store_invite_url: payload.store_invite_url,
      web_invite_url: payload.web_invite_url,
      google_group_url: payload.google_group_url ?? null,
      required_testers: payload.required_testers,
      short_description: payload.short_description,
      // MVP: 등록 즉시 매칭 큐 진입 (draft 단계 생략)
      status: "matching",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[apps/POST] insert failed", { code: error.code, message: error.message });
    return NextResponse.json(
      { ok: false, message: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
