import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/fetch-all";

export const runtime = "edge";
export const metadata = {
  title: "활동 랭킹",
  description:
    "Tester Match 커뮤니티 활동 통계 — 앱 등록, 테스트 참여, 14일 완주 랭킹과 방문자 현황.",
};

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

type RankedUser = {
  id: number;
  nickname: string;
  trust_score: number;
  count: number;
};

function RankingList({
  title,
  sub,
  rows,
  unit,
  accent,
  showStar = true,
  emptyText = "데이터 없음",
}: {
  title: string;
  sub: string;
  rows: RankedUser[];
  unit: string;
  accent: string;
  showStar?: boolean;
  emptyText?: string;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((u, i) => (
              <li key={u.id}>
                <Link
                  href={`/u/${u.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50"
                >
                  <Medal rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{u.nickname}</p>
                    {showStar && <p className="text-xs text-spark-500">★{u.trust_score}</p>}
                  </div>
                  <span className={`shrink-0 tabular text-sm font-bold ${accent}`}>
                    {u.count}
                    {unit}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default async function PublicStatsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseAdminClient();

  // ── 날짜 계산 (KST) ───────────────────────────────────────────────────
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(nowKst);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fromDateStr = sevenDaysAgo.toISOString().slice(0, 10);

  // ── 전체 수치 ─────────────────────────────────────────────────────────
  const [
    { count: totalUsers },
    { count: totalApps },
    { count: totalMatches },
    { count: completedMatches },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("apps").select("id", { count: "exact", head: true }).neq("status", "deleted"),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  // ── 방문자 (최근 7일) ─────────────────────────────────────────────────
  const pageViewRows = await fetchAll<{ visit_date: string }>((from, to) =>
    supabase
      .from("page_views")
      .select("visit_date")
      .gte("visit_date", fromDateStr)
      .lte("visit_date", todayStr)
      .order("visit_date")
      .range(from, to),
  );
  const viewsByDate = new Map<string, number>();
  for (const row of pageViewRows) {
    viewsByDate.set(row.visit_date, (viewsByDate.get(row.visit_date) ?? 0) + 1);
  }
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nowKst);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return {
      date: dateStr,
      visitors: viewsByDate.get(dateStr) ?? 0,
      label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
      sub: ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()],
      isToday: dateStr === todayStr,
    };
  });
  const todayVisitors = viewsByDate.get(todayStr) ?? 0;
  const weekVisitors = weeklyData.reduce((s, d) => s + d.visitors, 0);
  const maxVisitors = Math.max(...weeklyData.map((d) => d.visitors), 1);

  // ── 랭킹 집계 (공개 페이지 — 이메일 등 개인정보 미노출) ──────────────
  const [usersRows, apps, matches] = await Promise.all([
    fetchAll<{ id: number; nickname: string; trust_score: number }>((from, to) =>
      supabase
        .from("users")
        .select("id, nickname, trust_score")
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll<{ owner_user_id: number }>((from, to) =>
      supabase
        .from("apps")
        .select("owner_user_id")
        .neq("status", "deleted")
        .order("id")
        .range(from, to),
    ),
    fetchAll<{ tester_user_id: number; status: string }>((from, to) =>
      supabase.from("matches").select("tester_user_id, status").order("id").range(from, to),
    ),
  ]);

  const appCountByUser = new Map<number, number>();
  for (const a of apps) {
    appCountByUser.set(a.owner_user_id, (appCountByUser.get(a.owner_user_id) ?? 0) + 1);
  }
  const matchCountByUser = new Map<number, number>();
  const completedByUser = new Map<number, number>();
  for (const m of matches) {
    matchCountByUser.set(m.tester_user_id, (matchCountByUser.get(m.tester_user_id) ?? 0) + 1);
    if (m.status === "completed") {
      completedByUser.set(m.tester_user_id, (completedByUser.get(m.tester_user_id) ?? 0) + 1);
    }
  }

  const rank = (countByUser: Map<number, number>): RankedUser[] =>
    usersRows
      .map((u) => ({
        id: u.id,
        nickname: u.nickname,
        trust_score: u.trust_score,
        count: countByUser.get(u.id) ?? 0,
      }))
      .filter((u) => u.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

  const byApps = rank(appCountByUser);
  const byMatches = rank(matchCountByUser);

  // 신뢰도 랭킹 — 기본값(50) 초과, 즉 가점을 받은 사용자만. 동점은 완주 횟수 순.
  const byTrust: RankedUser[] = usersRows
    .filter((u) => u.trust_score > 50)
    .map((u) => ({
      id: u.id,
      nickname: u.nickname,
      trust_score: u.trust_score,
      count: u.trust_score,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (completedByUser.get(b.id) ?? 0) - (completedByUser.get(a.id) ?? 0),
    )
    .slice(0, 20);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">활동 랭킹</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Tester Match 커뮤니티의 활동 통계입니다. 닉네임을 클릭하면 등록한 앱을 볼 수 있습니다.
        </p>

        {/* 크레딧 보상 예고 배너 */}
        <div className="mt-6 rounded-2xl border border-spark-500/30 bg-spark-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl">🏆</span>
            <div>
              <p className="text-sm font-bold text-neutral-900">
                활동 랭킹에 크레딧 보상이 추가될 예정입니다
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                성실한 테스트 참여와 14일 완주가 정당하게 보상받는 문화를 만들어가려 합니다.
                추후 랭킹·완주 실적에 따라 크레딧 보상을 지급할 예정이니, 지금부터 쌓이는
                기록이 모두 반영됩니다. 꾸준한 참여 부탁드려요!
              </p>
            </div>
          </div>
        </div>

        {/* 전체 현황 */}
        <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="전체 사용자" value={totalUsers ?? 0} sub="명" />
          <StatCard label="등록 앱" value={totalApps ?? 0} sub="개" />
          <StatCard label="전체 매칭" value={totalMatches ?? 0} sub="건" />
          <StatCard label="14일 완주" value={completedMatches ?? 0} sub="건" />
        </section>

        {/* 방문자 현황 */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">방문자 현황</h2>
          <p className="mt-0.5 text-xs text-neutral-500">기기별 일 1회 집계 (KST)</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="오늘 방문자" value={todayVisitors} sub="고유 기기 수" />
            <StatCard label="7일 방문자" value={weekVisitors} sub="최근 1주 누계" />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="mb-5 text-sm font-semibold text-neutral-700">일별 방문자 추이</p>
            <div className="flex items-end gap-1.5" style={{ height: "96px" }}>
              {weeklyData.map(({ date, visitors, isToday }) => {
                const barH = Math.max(
                  Math.round((visitors / maxVisitors) * 80),
                  visitors > 0 ? 6 : 2,
                );
                return (
                  <div key={date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[11px] font-semibold text-neutral-500">{visitors}</span>
                    <div
                      className={`w-full rounded-t-sm ${isToday ? "bg-trust-500" : "bg-trust-200"}`}
                      style={{ height: `${barH}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5">
              {weeklyData.map(({ date, label, sub, isToday }) => (
                <div key={date} className="flex flex-1 flex-col items-center">
                  <span
                    className={`text-[10px] leading-tight ${
                      isToday ? "font-bold text-trust-600" : "text-neutral-400"
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`text-[9px] leading-tight ${
                      isToday ? "font-semibold text-trust-400" : "text-neutral-300"
                    }`}
                  >
                    {sub}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 랭킹 3종 */}
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <RankingList
            title="앱 등록 많은 순"
            sub="삭제된 앱 제외 · TOP 20"
            rows={byApps}
            unit="개"
            accent="text-trust-600"
          />
          <RankingList
            title="테스트 참여 많은 순"
            sub="전체 매칭 횟수 기준 · TOP 20"
            rows={byMatches}
            unit="회"
            accent="text-trust-600"
          />
          <RankingList
            title="신뢰도 높은 순"
            sub="14일 완주로 쌓는 점수 · TOP 20"
            rows={byTrust}
            unit="점"
            accent="text-spark-500"
            showStar={false}
            emptyText="아직 집계 중입니다. 14일 완주로 신뢰도를 쌓아보세요!"
          />
        </div>
      </main>
    </>
  );
}
