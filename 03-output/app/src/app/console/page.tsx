import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { getCurrentUser } from "@/lib/auth";
import { listConsoleOrders } from "@/lib/console-data";
import { CONSOLE_TOTAL_DAYS, attendanceRate } from "@/lib/console";
import { PAID_ORDER_STATUS_LABEL } from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";

export const metadata = { title: "대시보드" };

export default async function ConsoleHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/console");
  const orders = await listConsoleOrders(user);
  const isAdmin = user.role === "admin";

  const active = orders.filter((o) => o.status === "in_progress").length;
  const waiting = orders.filter((o) => o.status === "paid").length;
  const done = orders.filter((o) => o.status === "completed").length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">
          {isAdmin ? "전체 주문" : "내 유료 테스터"}
        </h1>
        <p className="m-0 text-sm text-ink-600">
          주문을 열면 테스터별 14일 출석표와 실행 스크린샷을 확인할 수 있습니다.
        </p>
      </div>

      <StatTiles>
        {[
          { label: "진행 중", value: active },
          { label: "충원 대기", value: waiting },
          { label: "완료", value: done },
        ].map((s) => (
          <StatTile key={s.label} rule label={s.label} value={<span className="font-mono">{s.value}</span>} />
        ))}
      </StatTiles>

      {orders.length === 0 ? (
        <EmptyState
          title="아직 주문이 없습니다."
          action={
            !isAdmin && (
              <ButtonLink href="/paid-testers" variant="secondary">
                유료 테스터 신청하기
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {orders.map((o) => {
            const rate = attendanceRate(
              Array.from({ length: o.doneCount }, () => ({ status: "done" as const })),
              o.slotCount || o.tester_count,
              o.dayN,
            );
            return (
              <li key={o.id}>
                <Link
                  href={`/console/orders/${o.id}`}
                  className="block border border-ink-900 bg-white p-5 text-ink-900 no-underline transition-colors hover:bg-surface-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-base font-semibold">
                        {o.apps?.name ?? "삭제된 앱"}{" "}
                        <span className="font-mono text-sm font-normal text-ink-600 tabular-nums">
                          · 테스터 {o.tester_count}명 · {formatKrw(o.amount_krw)}원
                        </span>
                      </p>
                      <p className="m-0 mt-1 font-mono text-xs text-ink-600 tabular-nums">
                        {isAdmin && o.users ? `${o.users.nickname} · ` : ""}
                        {o.order_code} · 주문{" "}
                        {new Date(o.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    </div>
                    <Badge tone="outline">{PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-4 font-mono text-xs text-ink-700 tabular-nums">
                    <span className="w-24 shrink-0 font-medium">
                      {o.dayN ? `D+${o.dayN} / ${CONSOLE_TOTAL_DAYS}` : "개시 전"}
                    </span>
                    <div className="h-2 flex-1 border border-ink-900 bg-white">
                      <div
                        className="h-full bg-ink-900"
                        style={{ width: `${o.dayN ? (o.dayN / CONSOLE_TOTAL_DAYS) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right">출석 {rate}%</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
