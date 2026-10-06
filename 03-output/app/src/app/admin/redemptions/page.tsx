import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKrw } from "@/lib/credits";
import { REWARD_CATALOG, type RewardKind } from "@/lib/rewards";
import { RedemptionActions } from "./redemption-actions";

export const runtime = "edge";
export const metadata = { title: "보상 교환" };

type Row = {
  id: number;
  kind: RewardKind;
  amount: number;
  status: "requested" | "done" | "rejected";
  contact: string;
  note: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  users: { nickname: string; email: string } | null;
};

const LABEL: Record<Row["status"], string> = {
  requested: "대기",
  done: "발송 완료",
  rejected: "거절",
};
const TONE: Record<Row["status"], string> = {
  requested: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
  rejected: "bg-neutral-100 text-neutral-500",
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}

export default async function AdminRedemptionsPage() {
  const user = await requireAdminUser("/admin/redemptions");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("credit_redemptions")
    .select(
      "id, kind, amount, status, contact, note, admin_note, created_at, processed_at, users!credit_redemptions_user_id_fkey(nickname, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];
  const pending = rows.filter((r) => r.status === "requested");
  const pendingKrw = pending.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">보상 교환</h1>
        <p className="mt-1 text-sm text-neutral-600">
          대기 <strong>{pending.length}건</strong> · 발송 예정 금액{" "}
          <strong>{formatKrw(pendingKrw)}원</strong>. 기프티콘·네이버페이 포인트 쿠폰을 연락처로 직접 보낸 뒤 [발송 완료].
          신청 시 크레딧은 이미 차감돼 있고, 거절하면 자동 복구.
        </p>

        {error ? (
          <p className="mt-10 text-sm font-medium text-red-600">
            목록 조회 실패: {error.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500">아직 신청이 없습니다.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>
                        {LABEL[r.status]}
                      </span>
                      <p className="font-semibold text-neutral-900">
                        {REWARD_CATALOG[r.kind]?.label ?? r.kind} {formatKrw(r.amount)} 크레딧 — {r.users?.nickname ?? "-"}
                      </p>
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-600">
                      연락처 <strong>{r.contact}</strong> · {r.users?.email ?? "-"}
                      {r.note ? ` · 요청: ${r.note}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      #{r.id} · 신청 {fmt(r.created_at)} · 처리 {fmt(r.processed_at)}
                      {r.admin_note ? ` · ${r.admin_note}` : ""}
                    </p>
                  </div>
                  {r.status === "requested" && <RedemptionActions id={r.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
