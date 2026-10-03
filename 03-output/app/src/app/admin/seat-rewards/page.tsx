import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKrw } from "@/lib/credits";
import { SEAT_REWARD_STATUS_LABEL, type SeatRewardStatus } from "@/lib/seat-reward-rules";
import { RewardActions } from "./reward-actions";

export const runtime = "edge";
export const metadata = { title: "시트 보상 정산" };

type Row = {
  id: number;
  order_id: number;
  amount: number;
  checkin_days: number;
  status: SeatRewardStatus;
  held_at: string;
  release_due_at: string;
  settled_at: string | null;
  settled_by: string | null;
  dispute_reason: string | null;
  admin_note: string | null;
  users: { nickname: string; email: string } | null;
};

const TONE: Record<SeatRewardStatus, string> = {
  held: "bg-amber-100 text-amber-800",
  released: "bg-emerald-100 text-emerald-800",
  disputed: "bg-red-100 text-red-700",
  forfeited: "bg-neutral-100 text-neutral-500",
};
const ORDER: Record<SeatRewardStatus, number> = { disputed: 0, held: 1, released: 2, forfeited: 3 };

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

export default async function AdminSeatRewardsPage() {
  const user = await requireAdminUser("/admin/seat-rewards");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("seat_rewards")
    .select(
      "id, order_id, amount, checkin_days, status, held_at, release_due_at, settled_at, settled_by, dispute_reason, admin_note, users(nickname, email)",
    )
    .order("held_at", { ascending: false })
    .limit(200);
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const disputed = rows.filter((r) => r.status === "disputed").length;
  const heldKrw = rows.filter((r) => r.status === "held").reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">시트 보상 정산</h1>
        <p className="mt-1 text-sm text-neutral-600">
          이의 검토 <strong>{disputed}건</strong> · 확정 대기 <strong>{formatKrw(heldKrw)} 크레딧</strong>.
          보류 건은 구매자 확정 또는 3일 후 자동 확정(6시간 간격 크론). 이의 건은 콘솔 스크린샷을
          확인해 [지급] 또는 [몰수] — 몰수하면 구매자 시트 환불이 자동 기록됩니다 (크레딧 결제는 즉시 환급,
          토스 결제는 주문 관리의 환불 대기로). 따로 환불하지 마세요.
        </p>

        {error ? (
          <p className="mt-10 text-sm font-medium text-red-600">목록 조회 실패: {error.message}</p>
        ) : rows.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500">아직 완주한 시트가 없습니다.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>
                        {SEAT_REWARD_STATUS_LABEL[r.status]}
                      </span>
                      <p className="font-semibold text-neutral-900">
                        {r.users?.nickname ?? "-"} — {r.checkin_days}일 · {formatKrw(r.amount)} 크레딧
                      </p>
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-500">
                      {r.users?.email ?? "-"} · 보류 {fmt(r.held_at)} · 자동 확정 {fmt(r.release_due_at)}
                      {r.settled_at ? ` · 처리 ${fmt(r.settled_at)} (${r.settled_by})` : ""}
                    </p>
                    {r.dispute_reason && (
                      <p className="mt-1 text-xs text-red-600">이의 사유: {r.dispute_reason}</p>
                    )}
                    {r.admin_note && <p className="mt-1 text-xs text-neutral-400">메모: {r.admin_note}</p>}
                    <Link
                      href={`/console/orders/${r.order_id}`}
                      className="mt-2 inline-block text-xs text-trust-600 underline underline-offset-2"
                    >
                      주문 #{r.order_id} 콘솔에서 증빙 보기 ↗
                    </Link>
                  </div>
                  {(r.status === "disputed" || r.status === "held") && (
                    <RewardActions id={r.id} canForfeit={r.status === "disputed"} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
