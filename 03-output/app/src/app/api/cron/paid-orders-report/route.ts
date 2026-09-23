import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { paidOrdersDailyReportEmail } from "@/lib/email-templates";
import { CONTACT_EMAIL } from "@/lib/site";

export const runtime = "edge";

const OPERATOR_EMAIL_PATTERN = "tester%@knockknock.company";
const PENDING_EXPIRY_HOURS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type OrderRow = {
  id: number;
  order_code: string;
  app_id: number;
  tester_count: number;
  status: string;
  paid_at: string | null;
  started_at: string | null;
  apps: { name: string } | null;
};

/** KST 기준 오늘 0시의 UTC ISO */
function kstDayStartIso(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const dayStartUtcMs =
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS;
  return new Date(dayStartUtcMs).toISOString();
}

/** KST 기준 올해 1월 1일 0시의 UTC ISO */
function kstYearStartIso(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), 0, 1) - KST_OFFSET_MS).toISOString();
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();

  // 1) 24시간 경과한 미결제 주문 자동 취소 (멱등 — 대상이 없으면 0건)
  const staleBefore = new Date(now.getTime() - PENDING_EXPIRY_HOURS * 60 * 60 * 1000);
  const { data: canceled } = await supabase
    .from("paid_tester_orders")
    .update({ status: "canceled", admin_note: "자동 취소 — 24시간 미결제" })
    .eq("status", "pending")
    .lt("created_at", staleBefore.toISOString())
    .select("id");
  const autoCanceledCount = (canceled ?? []).length;

  // 2) 진행 중 주문
  const { data: orderData } = await supabase
    .from("paid_tester_orders")
    .select("id, order_code, app_id, tester_count, status, paid_at, started_at, apps(name)")
    .in("status", ["paid", "in_progress"])
    .order("created_at", { ascending: true });
  const orders = (orderData ?? []) as unknown as OrderRow[];

  // 3) 운영자 테스터 계정
  const { data: operators } = await supabase
    .from("users")
    .select("id")
    .like("email", OPERATOR_EMAIL_PATTERN);
  const operatorIds = (operators ?? []).map((u) => u.id);

  const todayStartIso = kstDayStartIso(now);
  const reportRows = [];

  for (const order of orders) {
    let activeMatches = 0;
    let checkedInToday = 0;

    if (operatorIds.length > 0) {
      const { data: matches } = await supabase
        .from("matches")
        .select("id")
        .eq("app_id", order.app_id)
        .in("tester_user_id", operatorIds)
        .in("status", ["active", "completed"]);
      const matchIds = (matches ?? []).map((m) => m.id);
      activeMatches = matchIds.length;

      if (matchIds.length > 0) {
        const { count } = await supabase
          .from("checkins")
          .select("id", { count: "exact", head: true })
          .in("match_id", matchIds)
          .gte("created_at", todayStartIso);
        checkedInToday = count ?? 0;
      }
    }

    const baseIso = order.started_at ?? order.paid_at;
    const dayN = baseIso
      ? Math.min(14, Math.max(1, Math.floor((now.getTime() - new Date(baseIso).getTime()) / DAY_MS) + 1))
      : null;

    reportRows.push({
      orderCode: order.order_code,
      appName: order.apps?.name ?? `앱 #${order.app_id}`,
      testerCount: order.tester_count,
      status: order.status === "paid" ? "결제 완료 (투입 대기)" : "진행 중",
      dayN: order.started_at ? dayN : null,
      activeMatches,
      checkedInToday,
    });
  }

  // 4) 통신판매업 신고 기준(연 50회) 관찰용 — 올해 결제 건수
  const { count: yearlyPaidCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("purpose", "paid_testers")
    .eq("status", "completed")
    .gte("paid_at", kstYearStartIso(now));

  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const dateLabel = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;

  const tmpl = paidOrdersDailyReportEmail({
    dateLabel,
    orders: reportRows,
    autoCanceledCount,
    yearlyPaidCount: yearlyPaidCount ?? 0,
  });
  const emailResult = await sendEmail({ to: CONTACT_EMAIL, ...tmpl });

  return NextResponse.json({
    ok: true,
    activeOrders: reportRows.length,
    autoCanceledCount,
    yearlyPaidCount: yearlyPaidCount ?? 0,
    emailSent: emailResult.ok,
  });
}

export const POST = GET;
