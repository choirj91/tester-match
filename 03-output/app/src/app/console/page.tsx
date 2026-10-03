import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listConsoleOrders } from "@/lib/console-data";
import { CONSOLE_TOTAL_DAYS, attendanceRate } from "@/lib/console";
import { PAID_ORDER_STATUS_LABEL } from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";

export const runtime = "edge";
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
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-bold">{isAdmin ? "전체 주문" : "내 유료 테스터"}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        주문을 열면 테스터별 14일 출석표와 실행 스크린샷을 확인할 수 있습니다.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "진행 중", value: active },
          { label: "충원 대기", value: waiting },
          { label: "완료", value: done },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs text-neutral-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          아직 주문이 없습니다.{" "}
          {!isAdmin && (
            <Link href="/paid-testers" className="text-trust-600 underline underline-offset-2">
              유료 테스터 신청하기
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
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
                  className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-trust-500 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {o.apps?.name ?? "삭제된 앱"}{" "}
                        <span className="text-sm font-normal text-neutral-500">
                          · 테스터 {o.tester_count}명 · {formatKrw(o.amount_krw)}원
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {isAdmin && o.users ? `${o.users.nickname} · ` : ""}
                        {o.order_code} · 주문{" "}
                        {new Date(o.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      {PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600">
                    <span className="w-24 shrink-0 font-semibold">
                      {o.dayN ? `D+${o.dayN} / ${CONSOLE_TOTAL_DAYS}` : "개시 전"}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-trust-600"
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
