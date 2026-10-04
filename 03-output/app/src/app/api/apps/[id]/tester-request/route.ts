import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotificationsBulk } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const MAX_RECIPIENTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const BodySchema = z.object({
  user_ids: z.array(z.coerce.number().int().positive()).min(1).max(MAX_RECIPIENTS),
  message: z.string().trim().min(10, "요청 메시지를 10자 이상 적어주세요.").max(1000),
});

/**
 * 테스터 요청 릴레이 — 앱 등록자가 고른 회원에게 사이트 알림을 보낸다.
 * 회원 이메일을 등록자에게 넘기지 않기 위해 서버가 대신 전달한다. 앱당 24시간에 1회.
 */
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
    payload = BodySchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select("id, name, owner_user_id, status")
    .eq("id", appId)
    .maybeSingle();
  if (!app || app.owner_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  if (app.status !== "matching") {
    return NextResponse.json(
      { ok: false, message: "모집중 상태의 앱만 요청을 보낼 수 있습니다." },
      { status: 409 },
    );
  }

  // 등록자 단위 하루 1회 — 앱을 여러 개 가진 등록자가 앱마다 보내는 것을 막는다
  const link = `/browse/${appId}`;
  const { data: ownApps } = await supabase.from("apps").select("id").eq("owner_user_id", user.id);
  const ownLinks = (ownApps ?? []).map((a) => `/browse/${a.id}`);
  const { count: recent } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "tester_request")
    .in("link", ownLinks.length > 0 ? ownLinks : [link])
    .gte("created_at", new Date(Date.now() - DAY_MS).toISOString());
  if ((recent ?? 0) > 0) {
    return NextResponse.json(
      { ok: false, message: "테스터 요청은 하루에 한 번만 보낼 수 있습니다. 내일 다시 시도해주세요." },
      { status: 429 },
    );
  }

  // 수신자 검증 — 활성 회원만, 본인 제외
  const { data: recipients } = await supabase
    .from("users")
    .select("id")
    .in("id", payload.user_ids)
    .eq("status", "active")
    .neq("id", user.id);
  const ids = (recipients ?? []).map((u) => u.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "보낼 수 있는 수신자가 없습니다." }, { status: 400 });
  }

  const sent = await createNotificationsBulk(ids, {
    type: "tester_request",
    title: `[테스터 요청] ${app.name.slice(0, 60)}`,
    body: payload.message,
    link,
  });
  return NextResponse.json({ ok: true, sent });
}
