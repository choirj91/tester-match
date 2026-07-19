import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NOTICE_CATEGORY, PostUpdateSchema } from "@/lib/validators/post";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, category, title, body, view_count, created_at, updated_at, author_user_id, users_public_profile!posts_author_user_id_fkey!inner(nickname, trust_score)",
    )
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "찾을 수 없음" }, { status: 404 });
  }

  // view_count 증가는 정확도 낮아도 OK — 비차단 호출, 오류 무시.
  void supabase.rpc("increment_post_view", { p_post_id: postId });

  return NextResponse.json({ ok: true, post: data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  let payload;
  try {
    payload = PostUpdateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  // 공지 카테고리로 변경은 관리자 전용
  if (payload.category === NOTICE_CATEGORY && user.role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "공지사항은 관리자만 작성할 수 있습니다." },
      { status: 403 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("posts")
    .update(payload)
    .eq("id", postId)
    .eq("author_user_id", user.id);

  if (error) {
    console.error("[posts/PATCH]", error);
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
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_user_id", user.id);

  if (error) {
    console.error("[posts/DELETE]", error);
    return NextResponse.json({ ok: false, message: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
