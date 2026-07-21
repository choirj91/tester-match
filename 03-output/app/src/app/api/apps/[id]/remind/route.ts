import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/** KST 기준 오늘 00:00 (UTC ISO) */
function kstTodayStartIso(): string {
  const kstDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return new Date(`${kstDate}T00:00:00+09:00`).toISOString();
}

/**
 * POST /api/apps/[id]/remind — 오늘(KST) 체크인하지 않은 active 테스터에게 리마인드 알림.
 * 소유 개발자만. 스팸 방지: 테스터·앱당 하루 1회 (기존 알림 link+created_at 가드).
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
  const appId = Number(id);
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select("id, name, owner_user_id")
    .eq("id", appId)
    .maybeSingle();

  if (!app || app.owner_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const todayStart = kstTodayStartIso();

  // active 매치 + 오늘 체크인 여부
  const { data: matches } = await supabase
    .from("matches")
    .select("id, tester_user_id, checkins(checked_in_at)")
    .eq("app_id", appId)
    .eq("status", "active");

  const targets = (matches ?? []).filter((m) => {
    const checkins = (m.checkins ?? []) as Array<{ checked_in_at: string }>;
    return !checkins.some((c) => c.checked_in_at >= todayStart);
  });

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  const link = `/my-tests`;
  const dedupeLink = `/my-tests?remind_app=${appId}`;

  // 오늘 이미 보낸 테스터 제외 (앱별 dedupe link 기준)
  const { data: sentToday } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("link", dedupeLink)
    .gte("created_at", todayStart);
  const alreadySent = new Set((sentToday ?? []).map((n) => n.user_id));

  const fresh = targets.filter((m) => !alreadySent.has(m.tester_user_id));
  if (fresh.length > 0) {
    await supabase.from("notifications").insert(
      fresh.map((m) => ({
        user_id: m.tester_user_id,
        type: "match_reminder",
        title: `"${app.name}" 오늘 체크인을 잊지 마세요`,
        body: "개발자가 테스트 진행 확인을 기다리고 있어요. 앱을 실행하고 내 테스트에서 체크인해주세요.",
        link: dedupeLink,
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    sent: fresh.length,
    skipped: targets.length - fresh.length,
    link,
  });
}
