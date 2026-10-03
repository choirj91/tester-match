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
import { RedemptionForm } from "./redemption-form";

export const runtime = "edge";

export const metadata = { title: "크레딧" };

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/credits");

  const supabase = createSupabaseAdminClient();
  const [{ data: rows }, redeemable, { data: redemptions }] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("id, amount, balance_after, type, ref_type, ref_id, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    getRedeemable(supabase, user.id),
    supabase
      .from("credit_redemptions")
      .select("id, amount, status, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const REDEMPTION_LABEL: Record<string, string> = {
    requested: "처리 대기",
    done: "발송 완료",
    rejected: "거절 (환급)",
  };

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">크레딧</h1>
          <p className="mt-1 text-sm text-neutral-600">
            💰 유료 시트 14일 완주 시 {PAID_SEAT_REWARD} 크레딧. 내 앱 테스터 구매(1,000 = 1명) 또는{" "}
            {REDEMPTION_MIN_CREDITS.toLocaleString("ko-KR")} 이상 모아 기프티콘 교환.
          </p>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-trust-50 to-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">보유 크레딧</p>
            <p className="mt-2 text-4xl font-bold text-trust-600 tabular">
              {formatKrw(user.balance)} <span className="text-lg font-semibold">크레딧</span>
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              테스터 구매에 사용 가능 ·{" "}
              <Link href="/paid-testers" className="underline underline-offset-2">
                내 앱에 테스터 투입 →
              </Link>
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">기프티콘 교환 가능</p>
            <p className="mt-2 text-4xl font-bold text-amber-700 tabular">
              {formatKrw(redeemable)} <span className="text-lg font-semibold">크레딧</span>
            </p>
            <p className="mt-2 text-xs text-amber-800">유료 시트 완주 적립분만 해당 (1 크레딧 = 1원)</p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-neutral-900">🎁 기프티콘 교환</h2>
          <div className="mt-3">
            <RedemptionForm
              redeemable={redeemable}
              minCredits={REDEMPTION_MIN_CREDITS}
              unitCredits={REDEMPTION_UNIT_CREDITS}
            />
          </div>
          {redemptions && redemptions.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-100 text-sm">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span>
                    {formatKrw(r.amount)} 크레딧 · {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </span>
                  <span className="text-xs font-semibold text-neutral-600">
                    {REDEMPTION_LABEL[r.status] ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-neutral-900">내역</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {rows && rows.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {rows.map((r) => {
                  const isPositive = r.amount > 0;
                  return (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">
                          {CREDIT_TYPE_LABEL[r.type] ?? r.type}
                          {r.description && (
                            <span className="ml-2 text-xs text-neutral-500">· {r.description}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {new Date(r.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                        <span
                          className={`text-base font-bold tabular ${
                            isPositive ? "text-mint-500" : "text-crimson-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {formatKrw(r.amount)}
                        </span>
                        <span className="text-xs text-neutral-500 tabular">
                          잔액 {formatKrw(r.balance_after)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-neutral-600">아직 적립·사용 내역이 없습니다.</p>
                <p className="mt-2 text-xs text-neutral-500">
                  <Link href="/browse" className="underline underline-offset-2">
                    💰 시트가 열린 앱
                  </Link>
                  에 참여해 14일 완주하면 {PAID_SEAT_REWARD} 크레딧이 적립됩니다.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
