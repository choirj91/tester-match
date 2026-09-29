import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadConsoleOrder } from "@/lib/console-data";
import { CONSOLE_TOTAL_DAYS, attendanceRate, dayDateLabel } from "@/lib/console";
import { PAID_ORDER_STATUS_LABEL } from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { OrderMatrix } from "./order-matrix";
import { EnsureSlotsButton } from "./ensure-slots-button";

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

  const rate = attendanceRate(logs, slots.length, dayN);
  const dayLabels = order.started_at
    ? Array.from({ length: CONSOLE_TOTAL_DAYS }, (_, i) => dayDateLabel(order.started_at!, i + 1))
    : null;
  const screenshotCount = logs.filter((l) => l.screenshot_path).length;

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
          { label: "진행", value: dayN ? `D+${dayN} / ${CONSOLE_TOTAL_DAYS}` : "개시 전" },
          { label: "출석률", value: `${rate}%` },
          { label: "스크린샷", value: `${screenshotCount}장` },
          { label: "개시 · 결제", value: `${fmt(order.started_at)} · ${fmt(order.paid_at)}` },
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
          <p className="font-semibold">아직 테스트가 개시되지 않았습니다.</p>
          <p className="mt-1">
            {isAdmin
              ? "주문 관리에서 [테스트 개시]를 누르면 슬롯이 생성되고 1일차가 시작됩니다."
              : "운영팀이 테스터 계정 설치를 마치는 대로 개시됩니다. 개시 후 이 화면에서 매일 출석과 스크린샷을 확인할 수 있습니다."}
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
        <OrderMatrix
          orderId={order.id}
          isAdmin={isAdmin}
          slots={slots}
          logs={logs}
          dayN={dayN}
          dayLabels={dayLabels}
        />
      )}

      {order.admin_note && isAdmin && (
        <p className="mt-6 text-xs text-neutral-400">운영 메모: {order.admin_note}</p>
      )}
    </div>
  );
}
