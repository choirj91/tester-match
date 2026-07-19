import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ALL_POST_CATEGORIES, NOTICE_CATEGORY, PostCreateSchema } from "@/lib/validators/post";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("posts")
    .select(
      "id, category, title, view_count, created_at, author_user_id, users_public_profile!posts_author_user_id_fkey!inner(nickname, trust_score)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category && (ALL_POST_CATEGORIES as readonly string[]).includes(category)) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[posts/GET]", error);
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, posts: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload;
  try {
    payload = PostCreateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  // 공지는 관리자 전용
  if (payload.category === NOTICE_CATEGORY && user.role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "공지사항은 관리자만 작성할 수 있습니다." },
      { status: 403 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_user_id: user.id,
      category: payload.category,
      title: payload.title,
      body: payload.body,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[posts/POST]", error);
    return NextResponse.json({ ok: false, message: "작성 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
