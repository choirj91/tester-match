import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CREDIT_TYPE_LABEL, formatKrw } from "@/lib/credits";

export const runtime = 'edge';

export const metadata = { title: "크레딧" };

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/credits");

  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("credits_ledger")
    .select("id, amount, balance_after, type, ref_type, ref_id, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">크레딧</h1>
          <p className="mt-1 text-sm text-neutral-600">
            1원 = 1 크레딧. 14일 완주 시 800 크레딧 자동 적립.
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-gradient-to-br from-trust-50 to-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            현재 잔액
          </p>
          <p className="mt-2 text-5xl font-bold text-trust-600 tabular">
            {formatKrw(user.balance)}{" "}
            <span className="text-2xl font-semibold">크레딧</span>
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            ≈ {formatKrw(user.balance)}원 (충전·환불 시 1:1 환산)
          </p>
        </div>

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
                            <span className="ml-2 text-xs text-neutral-500">
                              · {r.description}
                            </span>
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
                <p className="text-sm text-neutral-600">
                  아직 적립·사용 내역이 없습니다.
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  매칭 가능 앱에 참여하고 14일 완주하면 800 크레딧이 적립됩니다.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
