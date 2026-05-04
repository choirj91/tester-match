import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppUpdateSchema } from "@/lib/validators/app";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("apps")
    .select(
      "id, owner_user_id, name, short_description, store_invite_url, web_invite_url, required_testers, status, created_at, updated_at",
    )
    .eq("id", appId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "찾을 수 없음" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, app: data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  let payload;
  try {
    payload = AppUpdateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // 닉네임 변경은 users 테이블 직접 갱신 (apps 컬럼 아님)
  const { nickname, ...appPatch } = payload;
  if (nickname && nickname !== user.nickname) {
    await supabase.from("users").update({ nickname }).eq("id", user.id);
  }

  if (Object.keys(appPatch).length > 0) {
    const { error } = await supabase
      .from("apps")
      .update(appPatch)
      .eq("id", appId)
      .eq("owner_user_id", user.id);
    if (error) {
      console.error("[apps/PATCH] failed", error);
      return NextResponse.json(
        { ok: false, message: "수정에 실패했습니다." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  // soft delete
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("apps")
    .update({ status: "deleted" })
    .eq("id", appId)
    .eq("owner_user_id", user.id);

  if (error) {
    console.error("[apps/DELETE] failed", error);
    return NextResponse.json(
      { ok: false, message: "삭제에 실패했습니다." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
