import { NextResponse } from "next/server";
import { countOpenSeatsByApp } from "@/lib/paid-seats";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createNotification } from "@/lib/notifications";

/**
 * F-BOOST-01 — 급구 자동 만료 sweep.
 *
 * 동작:
 *   1. boost_deadline_at <= now() AND is_boost = true → is_boost false 처리
 *      → 알림: boost_expired (급구 신청 화면 안내)
 *   2. boost_deadline_at BETWEEN now() AND now()+24h AND is_boost = true → D-1 알림
 *      → 알림: boost_expiring
 *   유료 시트가 열려 있는 앱은 둘 다 건너뛴다 (유료 주문 스윕이 급구를 연장한다).
 *   급구는 유료 테스터 결제로만 켜지므로 알림은 "다시 켜기"가 아니라 급구 신청 화면으로 보낸다.
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

  // 1) 만료된 급구 / 2) 24시간 안에 만료될 급구
  const [{ data: expired }, { data: expiring }] = await Promise.all([
    supabase
      .from("apps")
      .select("id, owner_user_id, name")
      .eq("is_boost", true)
      .lte("boost_deadline_at", now.toISOString()),
    supabase
      .from("apps")
      .select("id, owner_user_id, name, boost_deadline_at")
      .eq("is_boost", true)
      .gt("boost_deadline_at", now.toISOString())
      .lte("boost_deadline_at", in24h.toISOString()),
  ]);

  // 유료 시트가 열려 있는 앱은 급구를 유지한다 (일일 스윕이 마감을 다시 연장) — 해제도 D-1 안내도 하지 않는다
  const openSeats = await countOpenSeatsByApp(supabase, [
    ...(expired ?? []).map((a) => a.id),
    ...(expiring ?? []).map((a) => a.id),
  ]);
  // 열린 시트 수를 확인하지 못했으면 이번 실행에서는 아무것도 하지 않는다 (다음 실행에서 다시 판단)
  if (!openSeats) console.error("[boost-expiry] open seat lookup failed — skipping this run");
  const hasOpenSeats = (appId: number) => (openSeats?.get(appId) ?? 0) > 0;
  const clearable = openSeats ? (expired ?? []).filter((a) => !hasOpenSeats(a.id)) : [];
  const remindable = openSeats ? (expiring ?? []).filter((a) => !hasOpenSeats(a.id)) : [];

  let cleared = 0;
  for (const app of clearable) {
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
      title: "급구 기간이 끝났습니다",
      body: `"${app.name}" 급구 표시가 끝났습니다. 테스터가 더 필요하면 급구(유료 테스터)를 신청해주세요.`,
      link: paidOrderLink(app.id),
    });
  }

  let notified = 0;
  for (const app of remindable) {
    void createNotification({
      userId: app.owner_user_id,
      type: "boost_expiring",
      title: "급구가 곧 끝납니다 (D-1)",
      body: `"${app.name}" 급구 표시가 24시간 안에 끝납니다. 테스터가 더 필요하면 급구(유료 테스터)를 신청해주세요.`,
      link: paidOrderLink(app.id),
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

/** 급구 신청(유료 테스터 주문) 화면 — 해당 앱을 골라 둔 채로 연다 */
function paidOrderLink(appId: number): string {
  return `/paid-testers?app=${appId}`;
}
