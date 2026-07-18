import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listGroupMembers } from "@/lib/google-groups";
import { TESTER_GROUP_EMAIL } from "@/lib/tester-group";

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

  // ── 날짜 계산 (KST 기준 오늘 = UTC+9) ────────────────────────────────
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10); // YYYY-MM-DD
  const sevenDaysAgo = new Date(nowKst);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fromDateStr = sevenDaysAgo.toISOString().slice(0, 10);

  // ── 전체 수치 ─────────────────────────────────────────────────────────
  const [
    { count: totalUsers },
    { count: totalApps },
    { count: totalMatches },
    { count: activeMatches },
    { count: completedMatches },
    { count: totalRequests },
    { data: pageViewRows },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("apps").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("tester_request_sends").select("id", { count: "exact", head: true }),
    supabase.from("page_views").select("visit_date").gte("visit_date", fromDateStr).lte("visit_date", todayStr),
  ]);

  // ── 방문자 집계 ────────────────────────────────────────────────────────
  const viewsByDate = new Map<string, number>();
  for (const row of pageViewRows ?? []) {
    const d = row.visit_date as string;
    viewsByDate.set(d, (viewsByDate.get(d) ?? 0) + 1);
  }

  // 최근 7일 배열 (인덱스 0 = 6일 전, 6 = 오늘)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nowKst);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const mm = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return {
      date: dateStr,
      visitors: viewsByDate.get(dateStr) ?? 0,
      label: `${mm}/${dd}`,
      sub: dow,
      isToday: dateStr === todayStr,
    };
  });

  const todayVisitors = viewsByDate.get(todayStr) ?? 0;
  const weekVisitors = weeklyData.reduce((s, d) => s + d.visitors, 0);
  const maxVisitors = Math.max(...weeklyData.map((d) => d.visitors), 1);

  // ── 사용자 목록 ────────────────────────────────────────────────────────
  const { data: users } = await supabase
    .from("users")
    .select("id, nickname, email, trust_score, status, created_at, groups_joined_at")
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

  // ── 테스터 그룹 멤버 (Directory API 실시간) ───────────────────────────
  const groupMembers = await listGroupMembers();
  const userByEmail = new Map(
    (users ?? []).map((u) => [u.email.toLowerCase(), u]),
  );
  const groupRows = (groupMembers ?? [])
    .filter((m) => m.type === "USER")
    .map((m) => {
      const matched = userByEmail.get(m.email.toLowerCase());
      return {
        email: m.email,
        role: m.role,
        status: m.status,
        nickname: matched?.nickname ?? null,
        joinedAt: matched?.groups_joined_at ?? null,
        isServiceUser: !!matched,
      };
    })
    .sort((a, b) => (a.isServiceUser === b.isServiceUser ? 0 : a.isServiceUser ? -1 : 1));
  const dbJoinedCount = (users ?? []).filter((u) => u.groups_joined_at).length;

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

        {/* 방문자 현황 */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">방문자 현황</h2>
          <p className="mt-0.5 text-xs text-neutral-500">localStorage 세션 기준 · 기기별 일 1회 집계 (KST)</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="오늘 방문자" value={todayVisitors} sub="고유 기기 수" />
            <StatCard label="7일 방문자" value={weekVisitors} sub="최근 1주 누계" />
          </div>

          {/* 7일 바 차트 */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="mb-5 text-sm font-semibold text-neutral-700">일별 방문자 추이</p>
            {/* 바 영역 */}
            <div className="flex items-end gap-1.5" style={{ height: "96px" }}>
              {weeklyData.map(({ date, visitors, isToday }) => {
                const barH = Math.max(Math.round((visitors / maxVisitors) * 80), visitors > 0 ? 6 : 2);
                return (
                  <div key={date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[11px] font-semibold text-neutral-500">{visitors}</span>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isToday ? "bg-trust-500" : "bg-trust-200"
                      }`}
                      style={{ height: `${barH}px` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* 날짜 레이블 */}
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

        {/* 테스터 그룹 멤버 */}
        <section className="mt-12">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-neutral-900">테스터 그룹 멤버</h2>
            <span className="rounded-full bg-mint-500/10 px-2 py-0.5 text-[10px] font-bold text-mint-500">
              실시간
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {TESTER_GROUP_EMAIL} · Directory API 조회
            {groupMembers ? ` · 그룹 ${groupRows.length}명` : ""} · DB 가입 기록 {dbJoinedCount}명
          </p>

          {groupMembers === null ? (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
              그룹 멤버를 조회할 수 없습니다. 환경변수(GOOGLE_SERVICE_ACCOUNT_JSON 등) 또는
              도메인 위임 설정을 확인해주세요.
            </div>
          ) : groupRows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
              아직 그룹 멤버가 없습니다.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500">
                      <th className="px-4 py-3 font-semibold">이메일</th>
                      <th className="px-4 py-3 font-semibold">닉네임</th>
                      <th className="px-4 py-3 font-semibold">역할</th>
                      <th className="px-4 py-3 font-semibold">상태</th>
                      <th className="px-4 py-3 font-semibold">서비스 가입</th>
                      <th className="px-4 py-3 font-semibold">그룹 등록일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {groupRows.map((m) => (
                      <tr key={m.email} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 text-neutral-900">{m.email}</td>
                        <td className="px-4 py-3 text-neutral-700">{m.nickname ?? "—"}</td>
                        <td className="px-4 py-3 text-neutral-500">{m.role}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              m.status === "ACTIVE"
                                ? "bg-mint-500/10 text-mint-500"
                                : "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {m.isServiceUser ? (
                            <span className="font-semibold text-trust-600">회원</span>
                          ) : (
                            <span className="text-neutral-400">외부</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular text-neutral-400">
                          {m.joinedAt
                            ? new Date(m.joinedAt).toLocaleDateString("ko-KR")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

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
