import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";
export const metadata = { title: "사용자 통계" };

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return <span className="tabular w-5 text-center text-sm text-neutral-400">{rank}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

export default async function AdminStatsPage() {
  const user = await requireAdminUser("/admin/stats");
  const supabase = createSupabaseAdminClient();

  // ── 전체 수치 ─────────────────────────────────────────────────────────
  const [
    { count: totalUsers },
    { count: totalApps },
    { count: totalMatches },
    { count: activeMatches },
    { count: completedMatches },
    { count: totalRequests },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("apps").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("tester_request_sends").select("id", { count: "exact", head: true }),
  ]);

  // ── 사용자 목록 ────────────────────────────────────────────────────────
  const { data: users } = await supabase
    .from("users")
    .select("id, nickname, email, trust_score, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // ── 앱 목록 (deleted_at IS NULL) ──────────────────────────────────────
  const { data: apps } = await supabase
    .from("apps")
    .select("id, owner_user_id, status")
    .is("deleted_at", null);

  // ── 매칭 목록 ─────────────────────────────────────────────────────────
  const { data: matches } = await supabase
    .from("matches")
    .select("id, tester_user_id, status");

  // ── JS 집계 ───────────────────────────────────────────────────────────
  const appCountByUser = new Map<number, number>();
  for (const a of apps ?? []) {
    appCountByUser.set(a.owner_user_id, (appCountByUser.get(a.owner_user_id) ?? 0) + 1);
  }

  const matchCountByUser = new Map<number, number>();
  const completedByUser = new Map<number, number>();
  for (const m of matches ?? []) {
    matchCountByUser.set(m.tester_user_id, (matchCountByUser.get(m.tester_user_id) ?? 0) + 1);
    if (m.status === "completed") {
      completedByUser.set(m.tester_user_id, (completedByUser.get(m.tester_user_id) ?? 0) + 1);
    }
  }

  // ── 순위 목록 생성 ─────────────────────────────────────────────────────
  const userList = (users ?? []).map((u) => ({
    ...u,
    appCount: appCountByUser.get(u.id) ?? 0,
    matchCount: matchCountByUser.get(u.id) ?? 0,
    completedCount: completedByUser.get(u.id) ?? 0,
  }));

  const byApps = [...userList]
    .filter((u) => u.appCount > 0)
    .sort((a, b) => b.appCount - a.appCount)
    .slice(0, 20);

  const byMatches = [...userList]
    .filter((u) => u.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 20);

  const byCompleted = [...userList]
    .filter((u) => u.completedCount > 0)
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 20);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 관리자
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">사용자 통계</h1>

        {/* 전체 현황 */}
        <section className="mt-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="전체 사용자" value={totalUsers ?? 0} />
          <StatCard label="등록 앱" value={totalApps ?? 0} />
          <StatCard label="전체 매칭" value={totalMatches ?? 0} />
          <StatCard label="활성 매칭" value={activeMatches ?? 0} />
          <StatCard label="완주 매칭" value={completedMatches ?? 0} />
          <StatCard label="테스터 요청" value={totalRequests ?? 0} />
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {/* 앱 등록 순위 */}
          <section>
            <h2 className="text-lg font-bold text-neutral-900">앱 등록 많은 순</h2>
            <p className="mt-0.5 text-xs text-neutral-500">삭제된 앱 제외</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {byApps.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">데이터 없음</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {byApps.map((u, i) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <Medal rank={i + 1} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{u.nickname}</p>
                        <p className="truncate text-xs text-neutral-400">{u.email}</p>
                      </div>
                      <span className="shrink-0 tabular text-sm font-bold text-trust-600">
                        {u.appCount}개
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* 테스트 참여 순위 */}
          <section>
            <h2 className="text-lg font-bold text-neutral-900">테스트 참여 많은 순</h2>
            <p className="mt-0.5 text-xs text-neutral-500">전체 매칭 횟수 기준</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {byMatches.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">데이터 없음</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {byMatches.map((u, i) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <Medal rank={i + 1} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{u.nickname}</p>
                        <p className="truncate text-xs text-neutral-400">{u.email}</p>
                      </div>
                      <span className="shrink-0 tabular text-sm font-bold text-trust-600">
                        {u.matchCount}회
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* 완주 순위 */}
          <section>
            <h2 className="text-lg font-bold text-neutral-900">14일 완주 많은 순</h2>
            <p className="mt-0.5 text-xs text-neutral-500">status = completed 기준</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {byCompleted.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">데이터 없음</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {byCompleted.map((u, i) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <Medal rank={i + 1} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{u.nickname}</p>
                        <p className="truncate text-xs text-neutral-400">{u.email}</p>
                      </div>
                      <span className="shrink-0 tabular text-sm font-bold text-mint-500">
                        {u.completedCount}회
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* 전체 사용자 목록 */}
        <section className="mt-12">
          <h2 className="text-lg font-bold text-neutral-900">전체 사용자 목록</h2>
          <p className="mt-0.5 text-xs text-neutral-500">최근 가입 순 · {users?.length ?? 0}명</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500">
                    <th className="px-4 py-3 font-semibold">닉네임</th>
                    <th className="px-4 py-3 font-semibold">이메일</th>
                    <th className="px-4 py-3 font-semibold tabular">앱</th>
                    <th className="px-4 py-3 font-semibold tabular">매칭</th>
                    <th className="px-4 py-3 font-semibold tabular">완주</th>
                    <th className="px-4 py-3 font-semibold tabular">신뢰도</th>
                    <th className="px-4 py-3 font-semibold">가입일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {userList.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{u.nickname}</td>
                      <td className="px-4 py-3 text-neutral-500">{u.email}</td>
                      <td className="px-4 py-3 tabular text-center font-semibold text-trust-600">
                        {u.appCount || "—"}
                      </td>
                      <td className="px-4 py-3 tabular text-center text-neutral-700">
                        {u.matchCount || "—"}
                      </td>
                      <td className="px-4 py-3 tabular text-center font-semibold text-mint-500">
                        {u.completedCount || "—"}
                      </td>
                      <td className="px-4 py-3 tabular text-center text-neutral-700">
                        {u.trust_score}
                      </td>
                      <td className="px-4 py-3 text-neutral-400">
                        {new Date(u.created_at).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
