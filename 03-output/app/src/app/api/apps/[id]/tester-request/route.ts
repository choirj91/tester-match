import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { testerRequestEmail } from "@/lib/email-templates";

export const runtime = "edge";

const DAILY_LIMIT = 30;

type Params = { params: Promise<{ id: string }> };

// ── GET /api/apps/[id]/tester-request ────────────────────────────────
// 후보자 목록 + 오늘 발송 현황 반환
export async function GET(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "로그인 필요" }, { status: 401 });

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // 본인 앱인지 확인
  const { data: app } = await supabase
    .from("apps")
    .select("id, name, short_description, owner_user_id")
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ ok: false, message: "앱을 찾을 수 없습니다." }, { status: 404 });

  // 오늘(24h 롤링) 발송 건수
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await supabase
    .from("tester_request_sends")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", user.id)
    .gte("sent_at", since);

  const remaining = Math.max(0, DAILY_LIMIT - (todayCount ?? 0));

  // 이미 이 앱으로 요청 보낸 사람 ID 목록
  const { data: alreadySent } = await supabase
    .from("tester_request_sends")
    .select("recipient_user_id")
    .eq("sender_user_id", user.id)
    .eq("app_id", appId);
  const alreadySentIds = (alreadySent ?? []).map((r) => r.recipient_user_id);

  // 이미 이 앱에 매칭된 테스터 ID 목록
  const { data: matched } = await supabase
    .from("matches")
    .select("tester_user_id")
    .eq("app_id", appId)
    .in("status", ["pending", "active", "completed"]);
  const matchedIds = (matched ?? []).map((m) => m.tester_user_id);

  // 제외 ID 목록 (본인 + 이미 요청 + 이미 매칭)
  const excludeIds = Array.from(new Set([user.id, ...alreadySentIds, ...matchedIds]));

  // 후보자 조회 (최근 가입 순, 최대 200명)
  type UserRow = { id: number; nickname: string; trust_score: number; created_at: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("users")
    .select("id, nickname, trust_score, created_at")
    .eq("status", "active")
    .not("auth_user_id", "is", null) // placeholder 제외
    .order("created_at", { ascending: false })
    .limit(200);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: candidates } = (await query) as { data: UserRow[] | null };

  return NextResponse.json({
    ok: true,
    app: { id: app.id, name: app.name, short_description: app.short_description },
    candidates: candidates ?? [],
    today_count: todayCount ?? 0,
    daily_limit: DAILY_LIMIT,
    remaining,
  });
}

// ── POST /api/apps/[id]/tester-request ───────────────────────────────
// 선택한 수신자들에게 이메일 발송
const SendSchema = z.object({
  recipient_ids: z.array(z.number().int().positive()).min(1).max(DAILY_LIMIT),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "로그인 필요" }, { status: 401 });

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) return NextResponse.json({ ok: false }, { status: 400 });

  let body: z.infer<typeof SendSchema>;
  try {
    body = SendSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ ok: false, message: err.issues[0]?.message ?? "입력 오류" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 본인 앱 확인
  const { data: app } = await supabase
    .from("apps")
    .select("id, name, short_description, owner_user_id")
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ ok: false, message: "앱을 찾을 수 없습니다." }, { status: 404 });

  // 오늘 발송 건수 확인
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await supabase
    .from("tester_request_sends")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", user.id)
    .gte("sent_at", since);

  const remaining = Math.max(0, DAILY_LIMIT - (todayCount ?? 0));
  if (body.recipient_ids.length > remaining) {
    return NextResponse.json(
      { ok: false, message: `오늘 최대 ${remaining}명에게만 발송할 수 있습니다.` },
      { status: 429 },
    );
  }

  // 수신자 정보 조회
  const { data: recipients } = await supabase
    .from("users")
    .select("id, nickname, email")
    .in("id", body.recipient_ids)
    .eq("status", "active")
    .not("auth_user_id", "is", null);

  const recipientMap = new Map((recipients ?? []).map((r) => [r.id, r]));

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ id: number; reason: string }> = [];

  for (const recipientId of body.recipient_ids) {
    const recipient = recipientMap.get(recipientId);
    if (!recipient?.email) { skipped++; continue; }

    // DB에 발송 기록 INSERT (unique constraint로 중복 방지)
    const { error: insertErr } = await supabase
      .from("tester_request_sends")
      .insert({ sender_user_id: user.id, recipient_user_id: recipientId, app_id: appId })
      .single();

    if (insertErr) {
      // unique constraint violation → 이미 보낸 상태
      if (insertErr.code === "23505") { skipped++; continue; }
      errors.push({ id: recipientId, reason: insertErr.message });
      continue;
    }

    // 이메일 발송
    const email = testerRequestEmail({
      senderNickname: user.nickname,
      recipientNickname: recipient.nickname,
      appName: app.name,
      appId: app.id,
      subject: body.subject,
      message: body.message,
    });

    const result = await sendEmail({ to: recipient.email, ...email });
    if (result.ok) {
      sent++;
    } else {
      // 이메일 실패해도 DB 기록은 유지 (재발송 방지)
      errors.push({ id: recipientId, reason: result.reason });
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors });
}
