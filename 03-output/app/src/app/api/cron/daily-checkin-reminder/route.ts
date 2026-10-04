import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { dailyCheckinReminderEmail } from "@/lib/email-templates";
import {
  buildReminderItem,
  paidSeatNudgeLines,
  sortReminderItems,
  type ReminderCheckin,
  type ReminderItem,
} from "@/lib/checkin-reminder";
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
 * 일정: GitHub Actions 스케줄 "0 7 * * *" (KST 16:00 예약). 스케줄이 3~6시간 늦게 실행돼 실제 도착은 KST 19~22시.
 * 유료 시트는 스크린샷 증빙 기준으로 출석을 세고, 결석·연속 출석·적립 예정 크레딧을 함께 안내한다 (lib/checkin-reminder.ts).
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
      "id, opted_in_at, tester_user_id, paid_order_id, apps!inner(id, name), checkins(day_n, screenshot_url), users!matches_tester_user_id_fkey!inner(email, nickname, status)",
    )
    .eq("status", "active");

  if (error) {
    console.error("[cron/daily-reminder] query failed", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  type Entry = { email: string; nickname: string; pending: ReminderItem[]; userId: number };
  const byTester = new Map<number, Entry>();

  for (const m of matches ?? []) {
    if (!m.opted_in_at) continue;
    const app = Array.isArray(m.apps) ? m.apps[0] : m.apps;
    if (!app) continue;
    // 오늘 체크인이 끝났거나 기간이 지난 매칭은 null. 유료 시트는 스크린샷이 있어야 체크인으로 본다
    const item = buildReminderItem({
      appId: app.id,
      name: app.name,
      optedInAt: m.opted_in_at,
      isPaidSeat: m.paid_order_id != null,
      checkins: (m.checkins ?? []) as ReminderCheckin[],
    });
    if (!item) continue;

    const tester = Array.isArray(m.users) ? m.users[0] : m.users;
    if (!tester || tester.status !== "active") continue;
    if (!tester.email || tester.email.endsWith("@deleted.local")) continue;

    const entry: Entry = byTester.get(m.tester_user_id) ?? {
      email: tester.email,
      nickname: tester.nickname,
      pending: [],
      userId: m.tester_user_id,
    };
    entry.pending.push(item);
    byTester.set(m.tester_user_id, entry);
  }

  let sent = 0;
  let failed = 0;
  let paidSeatReminders = 0;
  for (const [, entry] of byTester) {
    const items = sortReminderItems(entry.pending);
    paidSeatReminders += items.filter((i) => i.paidSeat).length;
    const tmpl = dailyCheckinReminderEmail({ testerNickname: entry.nickname, items });
    const r = await sendEmail({
      to: entry.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (r.ok) sent++;
    else failed++;

    // 인앱 알림 — 앱별로 D-day 리마인더
    for (const p of items) {
      const remaining = 14 - p.dayN + 1;
      void createNotification({
        userId: entry.userId,
        type: "match_reminder",
        title: p.paidSeat
          ? p.paidSeat.lastChance
            ? "⚠️ 오늘 체크인하지 않으면 유료 시트가 해제됩니다"
            : "💰 유료 시트 체크인이 남았습니다"
          : "오늘 체크인을 완료해주세요",
        body: p.paidSeat
          ? `"${p.name}" ${p.dayN}일차 — ${paidSeatNudgeLines(p).slice(0, 2).join(" ")}`
          : `"${p.name}" D-${remaining} — 오늘(${p.dayN}일차) 체크인이 아직 완료되지 않았습니다.`,
        link: "/my-tests",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: byTester.size,
    sent,
    failed,
    paidSeatReminders,
  });
}

export const POST = GET;
