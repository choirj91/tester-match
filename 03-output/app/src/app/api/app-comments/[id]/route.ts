import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppCommentUpdateSchema } from "@/lib/validators/app-comment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  let payload;
  try {
    payload = AppCommentUpdateSchema.parse(await req.json());
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
  const { error } = await supabase
    .from("app_comments")
    .update({ body: payload.body })
    .eq("id", cid)
    .eq("author_user_id", user.id);

  if (error) {
    console.error("[app-comments/PATCH]", error);
    return NextResponse.json({ ok: false, message: "수정 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("app_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cid)
    .eq("author_user_id", user.id);

  if (error) {
    console.error("[app-comments/DELETE]", error);
    return NextResponse.json({ ok: false, message: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
