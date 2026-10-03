import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PAID_ORDER_STATUS_LABEL, type PaidOrderStatus } from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { OrderActions } from "./order-actions";
import { DigestActions } from "@/app/admin/digest/digest-actions";
import { OPEN_CHAT_URL } from "@/lib/site";
import { SEAT_FILLED_MATCH_STATUSES, seatNoticeText } from "@/lib/paid-seats";

export const runtime = "edge";
export const metadata = { title: "유료 테스터 주문" };

type Row = {
  id: number;
  order_code: string;
  tester_count: number;
  amount_krw: number;
  status: PaidOrderStatus;
  paid_at: string | null;
  started_at: string | null;
  admin_note: string | null;
  created_at: string;
  apps: { id: number; name: string } | null;
  users: { nickname: string; email: string } | null;
};

const STATUS_TONE: Record<PaidOrderStatus, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  paid: "bg-amber-100 text-amber-800",
  in_progress: "bg-trust-50 text-trust-600",
  completed: "bg-emerald-100 text-emerald-800",
  canceled: "bg-neutral-100 text-neutral-500",
  refunded: "bg-red-100 text-red-700",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPaidOrdersPage() {
  const user = await requireAdminUser("/admin/paid-orders");
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("paid_tester_orders")
    .select(
      "id, order_code, tester_count, amount_krw, status, paid_at, started_at, admin_note, created_at, apps(id, name), users(nickname, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const orders = (data ?? []) as unknown as Row[];

  const filled = new Map<number, number>();
  if (orders.length > 0) {
    const { data: seatRows } = await supabase
      .from("matches")
      .select("paid_order_id")
      .in(
        "paid_order_id",
        orders.map((o) => o.id),
      )
      .in("status", [...SEAT_FILLED_MATCH_STATUSES]);
    for (const m of seatRows ?? []) {
      if (m.paid_order_id != null) filled.set(m.paid_order_id, (filled.get(m.paid_order_id) ?? 0) + 1);
    }
  }

  const totalPaidKrw = orders
    .filter((o) => ["paid", "in_progress", "completed"].includes(o.status))
    .reduce((sum, o) => sum + o.amount_krw, 0);
  const activeCount = orders.filter((o) => ["paid", "in_progress"].includes(o.status)).length;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">유료 테스터 주문</h1>
        <p className="mt-1 text-sm text-neutral-600">
          결제 완료 시 관리자 메일 즉시 발송 · 매일 아침 일일 리포트 메일 · 진행{" "}
          <strong>{activeCount}건</strong> · 누적 매출 <strong>{formatKrw(totalPaidKrw)}원</strong>
        </p>

        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          운영 절차 (ADR-0012): 결제 확정 시 급구 노출 + 전 회원 알림 자동. [공지 복사] → 오픈채팅
          붙여넣기. 커뮤니티 테스터가 시트를 채우면 자동 진행(스샷 체크인은 콘솔에서 확인). 7일 내
          미충원 시트는 환불 또는 운영자 계정 투입(폴백) 후 [테스트 개시]. 결제 취소 환불은 토스
          대시보드에서 처리 후 [취소].
        </div>

        {orders.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500">아직 주문이 없습니다.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[o.status] ?? "bg-neutral-100"}`}
                      >
                        {PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <p className="font-semibold text-neutral-900">
                        {o.apps?.name ?? "삭제된 앱"} — 시트{" "}
                        <span className="text-amber-700">
                          {filled.get(o.id) ?? 0}/{o.tester_count}
                        </span>{" "}
                        · {formatKrw(o.amount_krw)}원
                      </p>
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-500">
                      구매자 {o.users?.nickname ?? "-"} ({o.users?.email ?? "-"}) · 주문{" "}
                      {fmtDate(o.created_at)} · 결제 {fmtDate(o.paid_at)} · 개시{" "}
                      {fmtDate(o.started_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {o.order_code}
                      {o.admin_note ? ` · ${o.admin_note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <Link
                      href={`/console/orders/${o.id}`}
                      className="hover:border-trust-500 hover:text-trust-600 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-700"
                    >
                      콘솔 ↗
                    </Link>
                    <OrderActions orderId={o.id} status={o.status} />
                  </div>
                </div>
                {o.apps && ["paid", "in_progress"].includes(o.status) && (
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <DigestActions
                      message={seatNoticeText({
                        appName: o.apps.name,
                        appId: o.apps.id,
                        seats: Math.max(0, o.tester_count - (filled.get(o.id) ?? 0)),
                      })}
                      openChatUrl={OPEN_CHAT_URL}
                    />
                  </div>
                )}
                <div className="hidden">
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
