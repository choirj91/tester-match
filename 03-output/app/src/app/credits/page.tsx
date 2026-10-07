import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CREDIT_TYPE_LABEL, formatKrw, getRedeemable } from "@/lib/credits";
import {
  PAID_SEAT_REWARD,
  REDEMPTION_MIN_CREDITS,
  REDEMPTION_UNIT_CREDITS,
} from "@/lib/paid-seats";
import { REWARD_CATALOG, type RewardKind } from "@/lib/rewards";
import { SEAT_REWARD_SUMMARY } from "@/lib/seat-reward-rules";
import { RedemptionForm } from "./redemption-form";

export const metadata = { title: "크레딧" };

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/credits");

  const supabase = createSupabaseAdminClient();
  const [{ data: rows }, redeemable, { data: pendingRewards }, { data: redemptions }] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("id, amount, balance_after, type, ref_type, ref_id, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    getRedeemable(supabase, user.id),
    supabase
      .from("seat_rewards")
      .select("amount, status")
      .eq("tester_user_id", user.id)
      .in("status", ["held", "disputed"]),
    supabase
      .from("credit_redemptions")
      .select("id, kind, amount, status, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pendingTotal = (pendingRewards ?? []).reduce((sum, r) => sum + r.amount, 0);
  const disputedCount = (pendingRewards ?? []).filter((r) => r.status === "disputed").length;

  const REDEMPTION_LABEL: Record<string, string> = {
    requested: "처리 대기",
    done: "발송 완료",
    rejected: "거절 (복구)",
  };

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header>
          <h1 className="text-2xl font-bold text-ink-900">크레딧</h1>
          <p className="mt-1 text-sm text-ink-700">
            💰 크레딧은 유료 시트 테스트로만 적립됩니다 — {SEAT_REWARD_SUMMARY}. 구매자 확정 후 지급.{" "}
            {REDEMPTION_MIN_CREDITS.toLocaleString("ko-KR")} 이상 모으면 기프티콘·네이버페이 포인트로 바꾸거나,
            내 앱의 테스터 시트를 여는 데 쓸 수 있습니다. 구매·양도·현금 환급은 안 됩니다.
          </p>
        </header>

        {pendingTotal > 0 && (
          <div className="mt-6 border border-warning-700 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            ⏳ <strong>확정 대기 {formatKrw(pendingTotal)} 크레딧</strong> — 구매자가 확인하면 바로,
            응답이 없으면 완주 3일 뒤 자동 지급됩니다.
            {disputedCount > 0 && ` (이의 검토 중 ${disputedCount}건 — 운영팀이 증빙 확인 후 판정)`}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border border-ink-200 bg-gradient-to-br from-surface-1 to-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-600">보유 크레딧</p>
            <p className="mt-2 text-4xl font-bold text-ink-900 tabular">
              {formatKrw(user.balance)} <span className="text-lg font-semibold">크레딧</span>
            </p>
            <p className="mt-2 text-xs text-ink-700">
              내 앱 테스터 시트 열기에 사용 가능 ·{" "}
              <Link href="/paid-testers" className="underline underline-offset-2">
                내 앱에 테스터 투입 →
              </Link>
            </p>
          </div>
          <div className="border border-warning-700 bg-warning-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning-700">보상 교환 가능</p>
            <p className="mt-2 text-4xl font-bold text-warning-700 tabular">
              {formatKrw(redeemable)} <span className="text-lg font-semibold">크레딧</span>
            </p>
            <p className="mt-2 text-xs text-warning-700">유료 시트 완주 적립분만 해당 (1 크레딧 = 1원)</p>
          </div>
        </div>

        <section className="mt-6 border border-ink-200 bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-ink-900">🎁 보상 교환 — 기프티콘 · 네이버페이 포인트</h2>
            <Link href="/rewards" className="text-xs text-ink-600 underline underline-offset-2">
              보상 안내 →
            </Link>
          </div>
          <div className="mt-3">
            <RedemptionForm
              redeemable={redeemable}
              minCredits={REDEMPTION_MIN_CREDITS}
              unitCredits={REDEMPTION_UNIT_CREDITS}
            />
          </div>
          {redemptions && redemptions.length > 0 && (
            <ul className="mt-4 divide-y divide-ink-200 text-sm">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span>
                    {REWARD_CATALOG[r.kind as RewardKind]?.label ?? r.kind} {formatKrw(r.amount)} 크레딧 ·{" "}
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </span>
                  <span className="text-xs font-semibold text-ink-700">
                    {REDEMPTION_LABEL[r.status] ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink-900">내역</h2>
          <div className="mt-4 overflow-hidden border border-ink-200 bg-white">
            {rows && rows.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {rows.map((r) => {
                  const isPositive = r.amount > 0;
                  return (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">
                          {CREDIT_TYPE_LABEL[r.type] ?? r.type}
                          {r.description && (
                            <span className="ml-2 text-xs text-ink-600">· {r.description}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-600">
                          {new Date(r.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                        <span
                          className={`text-base font-bold tabular ${
                            isPositive ? "text-success-700" : "text-danger-700"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {formatKrw(r.amount)}
                        </span>
                        <span className="text-xs text-ink-600 tabular">
                          잔액 {formatKrw(r.balance_after)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-ink-700">아직 적립·사용 내역이 없습니다.</p>
                <p className="mt-2 text-xs text-ink-600">
                  <Link href="/browse" className="underline underline-offset-2">
                    💰 시트가 열린 앱
                  </Link>
                  에 참여해 12일 이상 출석하면 최대 {PAID_SEAT_REWARD} 크레딧이 적립됩니다.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
