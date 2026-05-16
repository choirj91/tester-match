import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppCommentCreateSchema } from "@/lib/validators/app-comment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_comments")
    .select(
      "id, body, created_at, updated_at, author_user_id, promoted_app_id, users_public_profile!inner(nickname, trust_score)",
    )
    .eq("app_id", appId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[app-comments/GET]", error);
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, comments: data });
}

export async function POST(req: Request, { params }: Ctx) {
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
    payload = AppCommentCreateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // promoted_app_id 가 있으면 본인 소유 + 활성(non-deleted) 검증.
  let promotedAppId: number | null = null;
  if (payload.promoted_app_id != null) {
    const { data: pApp } = await supabase
      .from("apps")
      .select("id, owner_user_id, status")
      .eq("id", payload.promoted_app_id)
      .maybeSingle();
    if (!pApp || pApp.owner_user_id !== user.id || pApp.status === "deleted") {
      return NextResponse.json(
        { ok: false, message: "첨부할 본인 앱을 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    if (pApp.id === appId) {
      return NextResponse.json(
        { ok: false, message: "현재 보고 있는 앱은 첨부할 수 없습니다." },
        { status: 400 },
      );
    }
    promotedAppId = pApp.id;
  }

  const { data, error } = await supabase
    .from("app_comments")
    .insert({
      app_id: appId,
      author_user_id: user.id,
      body: payload.body,
      promoted_app_id: promotedAppId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[app-comments/POST]", error);
    return NextResponse.json({ ok: false, message: "작성 실패" }, { status: 500 });
  }

  // 앱 소유자에게 알림 (본인 댓글 제외)
  const { data: app } = await supabase
    .from("apps")
    .select("owner_user_id, name")
    .eq("id", appId)
    .maybeSingle();
  if (app && app.owner_user_id !== user.id) {
    void createNotification({
      userId: app.owner_user_id,
      type: "comment_new",
      title: "앱에 새 댓글이 달렸습니다",
      body: `${user.nickname}님: ${payload.body.slice(0, 80)}`,
      link: `/browse/${appId}`,
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
