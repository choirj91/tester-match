import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
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

  const showFillDeadline = !order.seats_closed && Boolean(order.paid_at);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <nav aria-label="경로" className="text-xs text-ink-600">
        <Link href="/console" className="text-ink-900 underline hover:text-accent-600">
          대시보드
        </Link>{" "}
        / <span className="text-ink-700">{order.apps?.name ?? "주문"}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">
          {order.apps?.name ?? "삭제된 앱"}
        </h1>
        <Badge tone="outline">{PAID_ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
      </div>

      <div className="grid items-start gap-6 min-[921px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <StatTiles>
            <StatTile
              rule
              label="시트 충원"
              value={
                <span className="font-mono text-xl">
                  {`${filledSeats} / ${order.tester_count}${order.seats_closed ? " (마감)" : ""}`}
                </span>
              }
            />
            <StatTile rule label="완주" value={<span className="font-mono text-xl">{`${completedSeats}명`}</span>} />
            <StatTile
              rule
              label="스크린샷"
              value={<span className="font-mono text-xl">{`${screenshotCount}장`}</span>}
            />
          </StatTiles>
          {order.apps && (
            <p className="m-0 text-xs text-ink-600">
              앱 상세·플랫폼 테스터 모니터링은{" "}
              <Link
                href={`/apps/${order.apps.id}`}
                className="font-mono text-ink-900 underline hover:text-accent-600"
              >
                /apps/{order.apps.id}
              </Link>
              에서 확인할 수 있습니다.
            </p>
          )}
        </div>

        <Receipt
          title={<span className="font-mono text-base">{order.order_code}</span>}
          meta={
            isAdmin && order.users ? `구매자 ${order.users.nickname} (${order.users.email})` : undefined
          }
        >
          <ReceiptDivider />
          <ReceiptRows>
            <ReceiptRow
              strong
              label={`테스터 ${order.tester_count}명`}
              value={`${formatKrw(order.amount_krw)}원`}
            />
          </ReceiptRows>
          <ReceiptDivider />
          <ReceiptRows className="text-[13px]">
            <ReceiptRow label="결제" value={fmt(order.paid_at)} />
            {showFillDeadline && order.paid_at && (
              <ReceiptRow
                label="충원 마감 (이후 빈 시트 환불)"
                value={fmt(fillDeadline(order.paid_at).toISOString())}
              />
            )}
          </ReceiptRows>
        </Receipt>
      </div>

      {!order.started_at ? (
        <Notice title="아직 시트에 참여한 테스터가 없습니다.">
          <p className="m-0">
            {isAdmin
              ? "커뮤니티 테스터가 참여하면 자동으로 시작됩니다. 운영자 계정을 투입(폴백)하려면 주문 관리에서 [테스트 개시]."
              : order.seats_closed
                ? "시트가 마감된 주문입니다. 채워지지 않은 시트는 환불 정책에 따라 처리됩니다."
                : "앱이 급구 상단에 노출 중이며 전 회원에게 알림이 발송되었습니다. 테스터가 시트를 채우면 이 화면에서 매일 출석과 스크린샷을 확인할 수 있습니다. 결제 후 7일 내 채워지지 않은 시트는 환불됩니다."}
          </p>
          {isAdmin && (
            <ButtonLink href="/admin/paid-orders" size="sm" className="mt-3">
              주문 관리로 이동
            </ButtonLink>
          )}
        </Notice>
      ) : slots.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 border border-ink-900 p-6 text-sm text-ink-700">
          슬롯이 아직 없습니다.{" "}
          {isAdmin ? <EnsureSlotsButton orderId={order.id} /> : "운영팀이 곧 준비합니다."}
        </div>
      ) : (
        <section aria-labelledby="matrix-heading" className="flex flex-col gap-3 border-t border-ink-900 pt-6">
          <h2 id="matrix-heading" className="m-0 font-display text-h3 font-semibold text-ink-900">
            출석표
          </h2>
          <p className="m-0 text-xs text-ink-600">
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
        </section>
      )}

      {settlement.length > 0 && <SeatSettlement orderId={order.id} rows={settlement} />}

      {order.admin_note && isAdmin && (
        <p className="m-0 text-xs text-ink-600">운영 메모: {order.admin_note}</p>
      )}
    </div>
  );
}
