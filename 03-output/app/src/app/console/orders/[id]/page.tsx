import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadConsoleOrder } from "@/lib/console-data";
import { fillDeadline, loadSeatCounts } from "@/lib/paid-seats";
import { PAID_ORDER_STATUS_LABEL } from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { OrderMatrix } from "./order-matrix";
import { EnsureSlotsButton } from "./ensure-slots-button";
import { SeatSettlement, type SettlementRow } from "./seat-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SeatRewardStatus } from "@/lib/seat-reward-rules";

export const runtime = "edge";
export const metadata = { title: "주문 상세" };

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ConsoleOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=/console/orders/${id}`);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const detail = await loadConsoleOrder(orderId, user);
  if (!detail) notFound();
  const { order, slots, logs, dayN, isAdmin } = detail;

  const seatCounts = await loadSeatCounts(createSupabaseAdminClient(), [orderId]);
  const filledSeats = seatCounts.filled.get(orderId) ?? 0;
  const completedSeats = seatCounts.completed.get(orderId) ?? 0;
  // 테스터마다 참여일이 달라 달력 날짜 대신 "각 테스터의 n일차" 로 표기한다
  const dayLabels: string[] | null = null;
  const screenshotCount = logs.filter((l) => l.screenshot_path).length;

  // 보상 정산 (에스크로) — 접근 권한은 loadConsoleOrder 가 이미 검증
  const { data: rewardRows } = await createSupabaseAdminClient()
    .from("seat_rewards")
    .select("id, amount, checkin_days, status, release_due_at, dispute_reason, users(nickname)")
    .eq("order_id", orderId)
    .order("held_at", { ascending: true });
  const settlement: SettlementRow[] = (
    (rewardRows ?? []) as unknown as Array<{
      id: number;
      amount: number;
      checkin_days: number;
      status: SeatRewardStatus;
      release_due_at: string;
      dispute_reason: string | null;
      users: { nickname: string } | null;
    }>
  ).map((r) => ({
    id: r.id,
    nickname: r.users?.nickname ?? "테스터",
    amount: r.amount,
    checkinDays: r.checkin_days,
    status: r.status,
    releaseDueAt: r.release_due_at,
    disputeReason: r.dispute_reason,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="text-xs text-neutral-500">
        <Link href="/console" className="hover:text-neutral-900">
          대시보드
        </Link>{" "}
        / <span className="text-neutral-700">{order.apps?.name ?? "주문"}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{order.apps?.name ?? "삭제된 앱"}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            테스터 {order.tester_count}명 · {formatKrw(order.amount_krw)}원 · {order.order_code}
            {isAdmin && order.users ? ` · 구매자 ${order.users.nickname} (${order.users.email})` : ""}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
          {PAID_ORDER_STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          {
            label: "시트 충원",
            value: `${filledSeats} / ${order.tester_count}${order.seats_closed ? " (마감)" : ""}`,
          },
          { label: "완주", value: `${completedSeats}명` },
          { label: "스크린샷", value: `${screenshotCount}장` },
          order.seats_closed || !order.paid_at
            ? { label: "결제", value: fmt(order.paid_at) }
            : { label: "충원 마감 (이후 빈 시트 환불)", value: fmt(fillDeadline(order.paid_at).toISOString()) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs text-neutral-500">{s.label}</p>
            <p className="mt-1 text-sm font-bold sm:text-base">{s.value}</p>
          </div>
        ))}
      </div>

      {order.apps && (
        <p className="mt-3 text-xs text-neutral-500">
          앱 상세·플랫폼 테스터 모니터링은{" "}
          <Link href={`/apps/${order.apps.id}`} className="text-trust-600 underline underline-offset-2">
            /apps/{order.apps.id}
          </Link>
          에서 확인할 수 있습니다.
        </p>
      )}

      {!order.started_at ? (
        <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">아직 시트에 참여한 테스터가 없습니다.</p>
          <p className="mt-1">
            {isAdmin
              ? "커뮤니티 테스터가 참여하면 자동으로 시작됩니다. 운영자 계정을 투입(폴백)하려면 주문 관리에서 [테스트 개시]."
              : "앱이 급구 상단에 노출 중이며 전 회원에게 알림이 발송되었습니다. 테스터가 시트를 채우면 이 화면에서 매일 출석과 스크린샷을 확인할 수 있습니다. 결제 후 7일 내 채워지지 않은 시트는 환불됩니다."}
          </p>
          {isAdmin && (
            <Link
              href="/admin/paid-orders"
              className="mt-3 inline-block rounded-lg bg-trust-600 px-4 py-2 text-xs font-semibold text-white hover:bg-trust-700"
            >
              주문 관리로 이동
            </Link>
          )}
        </div>
      ) : slots.length === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          슬롯이 아직 없습니다.{" "}
          {isAdmin ? <EnsureSlotsButton orderId={order.id} /> : "운영팀이 곧 준비합니다."}
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs text-neutral-500">
            열 번호는 달력 날짜가 아니라 <strong>각 테스터의 참여일 기준 n일차</strong>입니다. 14일
            중 12일 이상 출석하면 완주이며, 결석 3일째 테스터는 자동 교체됩니다.
          </p>
          <OrderMatrix
            orderId={order.id}
            isAdmin={isAdmin}
            slots={slots}
            logs={logs}
            dayN={dayN}
            dayLabels={dayLabels}
          />
        </>
      )}

      {settlement.length > 0 && <SeatSettlement orderId={order.id} rows={settlement} />}

      {order.admin_note && isAdmin && (
        <p className="mt-6 text-xs text-neutral-400">운영 메모: {order.admin_note}</p>
      )}
    </div>
  );
}
