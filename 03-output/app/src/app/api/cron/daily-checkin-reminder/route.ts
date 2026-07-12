import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { dailyCheckinReminderEmail } from "@/lib/email-templates";
import { currentDayN } from "@/lib/checkin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "edge";

/**
 * F-CHK-01 — 일일 체크인 리마인더.
 *
 * 동작:
 *   1. 모든 active 매칭 조회 (tester_user_id, opted_in_at, app.name, checkins[])
 *   2. 테스터별 그룹 → 오늘 day_n 체크 안 한 매칭만 추출
 *   3. 테스터당 1통의 메일로 묶어서 발송
 *
 * Cloudflare Cron 권장 일정: 매일 KST 20:00 (UTC 11:00)
 *   `wrangler.toml`:
 *     [triggers]
 *     crons = ["0 11 * * *"]
 *
 * 보안:
 *   - 운영: CRON_SECRET 환경 변수 + Authorization: Bearer 헤더 일치 시만 실행
 *   - 로컬: CRON_SECRET 미설정이면 통과 (수동 GET 으로 테스트 가능)
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      "id, opted_in_at, tester_user_id, apps!inner(id, name), checkins(day_n), users!matches_tester_user_id_fkey!inner(email, nickname, status)",
    )
    .eq("status", "active");

  if (error) {
    console.error("[cron/daily-reminder] query failed", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  type Pending = { name: string; appId: number; dayN: number };
  type Entry = { email: string; nickname: string; pending: Pending[]; userId: number };
  const byTester = new Map<number, Entry>();

  for (const m of matches ?? []) {
    if (!m.opted_in_at) continue;
    const dayN = currentDayN(m.opted_in_at);
    if (dayN === 0) continue; // 만료

    const checkins = (m.checkins ?? []) as Array<{ day_n: number }>;
    if (checkins.some((c) => c.day_n === dayN)) continue; // 오늘 이미 체크인

    const tester = Array.isArray(m.users) ? m.users[0] : m.users;
    if (!tester || tester.status !== "active") continue;
    if (!tester.email || tester.email.endsWith("@deleted.local")) continue;

    const app = Array.isArray(m.apps) ? m.apps[0] : m.apps;
    if (!app) continue;

    const entry: Entry = byTester.get(m.tester_user_id) ?? {
      email: tester.email,
      nickname: tester.nickname,
      pending: [],
      userId: m.tester_user_id,
    };
    entry.pending.push({ name: app.name, appId: app.id, dayN });
    byTester.set(m.tester_user_id, entry);
  }

  let sent = 0;
  let failed = 0;
  for (const [, entry] of byTester) {
    const tmpl = dailyCheckinReminderEmail({
      testerNickname: entry.nickname,
      apps: entry.pending,
    });
    const r = await sendEmail({
      to: entry.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (r.ok) sent++;
    else failed++;

    // 인앱 알림 — 앱별로 D-day 리마인더
    for (const p of entry.pending) {
      const remaining = 14 - p.dayN + 1;
      void createNotification({
        userId: entry.userId,
        type: "match_reminder",
        title: "오늘 체크인을 완료해주세요",
        body: `"${p.name}" D-${remaining} — 오늘(${p.dayN}일차) 체크인이 아직 완료되지 않았습니다.`,
        link: "/my-tests",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: byTester.size,
    sent,
    failed,
  });
}

export const POST = GET;
