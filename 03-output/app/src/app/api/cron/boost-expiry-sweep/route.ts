import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "edge";

/**
 * F-BOOST-01 — 급구 자동 만료 sweep.
 *
 * 동작:
 *   1. boost_deadline_at <= now() AND is_boost = true → is_boost false 처리
 *      → 알림: boost_expired (재활성 유도)
 *   2. boost_deadline_at BETWEEN now() AND now()+24h AND is_boost = true → D-1 알림
 *      → 알림: boost_expiring
 *
 * Cloudflare Cron 권장 일정: 매일 KST 09:00 (UTC 00:00)
 *   [triggers]
 *   crons = ["0 0 * * *"]
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1) 만료된 급구 해제
  const { data: expired } = await supabase
    .from("apps")
    .select("id, owner_user_id, name")
    .eq("is_boost", true)
    .lte("boost_deadline_at", now.toISOString());

  let cleared = 0;
  for (const app of expired ?? []) {
    const { error } = await supabase
      .from("apps")
      .update({ is_boost: false, boost_deadline_at: null })
      .eq("id", app.id)
      .eq("is_boost", true); // 동시성 가드
    if (error) {
      console.error("[boost-expiry] update failed", app.id, error);
      continue;
    }
    cleared++;
    void createNotification({
      userId: app.owner_user_id,
      type: "boost_expired",
      title: "급구 기간이 종료되었습니다",
      body: `"${app.name}" 급구가 자동 해제되었습니다. 다시 켜면 7일간 최상단 노출됩니다.`,
      link: `/apps/${app.id}`,
    });
  }

  // 2) D-1 알림 (24시간 이내 만료)
  const { data: expiring } = await supabase
    .from("apps")
    .select("id, owner_user_id, name, boost_deadline_at")
    .eq("is_boost", true)
    .gt("boost_deadline_at", now.toISOString())
    .lte("boost_deadline_at", in24h.toISOString());

  let notified = 0;
  for (const app of expiring ?? []) {
    void createNotification({
      userId: app.owner_user_id,
      type: "boost_expiring",
      title: "급구 곧 만료됩니다 (D-1)",
      body: `"${app.name}" 급구가 24시간 이내 자동 해제됩니다. 갱신하려면 관리 페이지에서 [갱신 +7일] 눌러주세요.`,
      link: `/apps/${app.id}`,
    });
    notified++;
  }

  return NextResponse.json({
    ok: true,
    cleared,
    notified,
    candidates: (expired?.length ?? 0) + (expiring?.length ?? 0),
  });
}

export const POST = GET;
