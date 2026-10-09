import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { weeklyReportEmail } from "@/lib/email-templates";
import {
  formatWindowLabel,
  gainCounts,
  loadGainReport,
  weeklyReportWindow,
} from "@/lib/gain-report";
import { CONTACT_EMAIL } from "@/lib/site";
import { opsSlackWebhookUrl, postSlackMessage, weeklyReportSlackPayload } from "@/lib/slack";

/**
 * 주간 관리자 리포트 (매주 금요일 KST 22:00, 2026-10-09 운영자 요청).
 * 지난 금요일 22:00 → 이번 금요일 22:00 (KST) 동안 크레딧·신뢰도가 늘어난 회원 목록을
 * 일일 리포트와 같은 관리자 메일·운영 Slack 으로 보낸다. 조회는 member_gain_report 한 번(행이 많으면 이어 읽기).
 * 응답 JSON 은 숫자·참거짓만 — Functions 가 응답 요약을 Slack 으로 옮기므로 목록·닉네임은 싣지 않는다.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const window = weeklyReportWindow(new Date());
  const windowLabel = formatWindowLabel(window);
  const gains = await loadGainReport(supabase, window);

  const emailResult = await sendEmail({
    to: getAdminNotifyEmail(CONTACT_EMAIL),
    ...weeklyReportEmail({ windowLabel, gains }),
  });
  const slackResult = await postSlackMessage(
    opsSlackWebhookUrl(),
    weeklyReportSlackPayload({ windowLabel, gains }),
  );

  // 조회 실패이거나 메일·Slack 둘 다 못 보냈으면 500 — 주간 리포트가 조용히 사라지지 않게 실행 실패로 남긴다
  const ok = gains.ok && (emailResult.ok || slackResult.ok);
  return NextResponse.json(
    {
      ok,
      since: window.since.toISOString(),
      until: window.until.toISOString(),
      ...gainCounts(gains),
      emailSent: emailResult.ok,
      slackSent: slackResult.ok,
    },
    { status: ok ? 200 : 500 },
  );
}

export const POST = GET;
