import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TESTER_GROUP_URL } from "@/lib/tester-group";

export const runtime = "edge";

/**
 * POST /api/admin/notify-group-upgrade
 * 레거시 앱(공용 그룹 미사용) 소유자에게 전환 유도 인앱 알림 일괄 발송.
 *
 * 멱등성: 같은 앱 링크(/apps/{id})의 group_upgrade 알림이 이미 있으면 스킵.
 * 여러 번 눌러도 중복 발송 없음.
 */
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  // 1) 레거시 앱 조회 (삭제 제외, 공용 그룹 미사용)
  const { data: apps, error } = await supabase
    .from("apps")
    .select("id, name, owner_user_id, google_group_url")
    .neq("status", "deleted");

  if (error) {
    console.error("[notify-group-upgrade] apps query failed", error);
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }

  const legacy = (apps ?? []).filter((a) => a.google_group_url !== TESTER_GROUP_URL);

  if (legacy.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, sent: 0, skipped: 0 });
  }

  // 2) 이미 발송된 알림 링크 집합 (멱등 가드)
  const { data: existing } = await supabase
    .from("notifications")
    .select("link")
    .eq("type", "group_upgrade");
  const alreadySent = new Set((existing ?? []).map((n) => n.link));

  // 3) 발송 (앱 1건당 1회)
  let sent = 0;
  let skipped = 0;
  for (const app of legacy) {
    const link = `/apps/${app.id}`;
    if (alreadySent.has(link)) {
      skipped++;
      continue;
    }
    const { error: insErr } = await supabase.from("notifications").insert({
      user_id: app.owner_user_id,
      type: "group_upgrade",
      title: "🚀 새 기능: 공용 테스터 그룹",
      body: `"${app.name}" 을 공용 그룹으로 전환하면 테스터가 그룹 가입 절차 없이 로그인만으로 바로 참여할 수 있습니다. 관리 페이지에서 버튼 한 번이면 끝!`,
      link,
    });
    if (insErr) {
      console.error("[notify-group-upgrade] insert failed", app.id, insErr.message);
      continue;
    }
    sent++;
  }

  return NextResponse.json({
    ok: true,
    candidates: legacy.length,
    sent,
    skipped,
  });
}
