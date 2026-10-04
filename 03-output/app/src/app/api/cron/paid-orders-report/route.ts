import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { paidOrdersDailyReportEmail } from "@/lib/email-templates";
import { buildOrderReport } from "@/lib/paid-order-report";
import { runSweepStep } from "@/lib/paid-order-sweep";
import { AUTO_CANCEL_NOTE_PREFIX } from "@/lib/paid-order-sweep-rules";
import { CONTACT_EMAIL } from "@/lib/site";

export const runtime = "edge";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 기준 올해 1월 1일 0시의 UTC ISO */
function kstYearStartIso(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), 0, 1) - KST_OFFSET_MS).toISOString();
}

/**
 * 유료 주문 스윕 + 관리자 리포트 (매일 KST 08:30).
 *
 *   ?mode=sweep   : 스윕 한 단계만 (메일 없음). 응답의 more 가 true 면 다시 호출 — 요청당 처리량 상한 때문.
 *   ?mode=preview : 리포트 내용만 JSON 으로 (메일 없음) — 운영자가 경보를 바로 확인할 때.
 *   (기본)        : 리포트 메일. 처리할 일이 있으면 제목에 [ACTION].
 * 워크플로우는 sweep 을 more=false 까지 반복한 뒤 기본 모드를 한 번 호출한다.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();

  const mode = new URL(request.url).searchParams.get("mode");

  if (mode === "sweep") {
    try {
      const step = await runSweepStep(supabase, now);
      return NextResponse.json({ ok: true, ...step });
    } catch (err) {
      // 대상 조회·기록 실패 — 500 으로 돌려 크론 잡이 실패로 보이게 한다
      const message = err instanceof Error ? err.message : "스윕 실패";
      console.error("[cron/paid-orders-report] sweep failed", err);
      return NextResponse.json({ ok: false, message }, { status: 500 });
    }
  }

  const report = await buildOrderReport(supabase, now);
  if (mode === "preview") {
    return NextResponse.json({ ok: true, activeOrders: report.rows, alerts: report.alerts });
  }

  const [yearlyPaid, autoCanceled] = await Promise.all([
    // 통신판매업 신고 기준(연 50회) 관찰용 — 올해 결제 건수
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("purpose", "paid_testers")
      .eq("status", "completed")
      .gte("paid_at", kstYearStartIso(now)),
    // 최근 24시간 스윕이 자동 취소한 미결제 주문
    supabase
      .from("paid_tester_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "canceled")
      .like("admin_note", `${AUTO_CANCEL_NOTE_PREFIX}%`)
      .gte("swept_at", new Date(now.getTime() - DAY_MS).toISOString()),
  ]);

  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const dateLabel = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;

  const tmpl = paidOrdersDailyReportEmail({
    dateLabel,
    orders: report.rows,
    autoCanceledCount: autoCanceled.count ?? 0,
    yearlyPaidCount: yearlyPaid.count ?? 0,
    alerts: report.alerts,
  });
  const emailResult = await sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...tmpl });

  return NextResponse.json({
    ok: true,
    activeOrders: report.rows.length,
    alerts: report.alerts,
    yearlyPaidCount: yearlyPaid.count ?? 0,
    emailSent: emailResult.ok,
  });
}

export const POST = GET;
