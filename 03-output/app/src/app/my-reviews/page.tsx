import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";
export const metadata = { title: "맞리뷰" };

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}

function TrustBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-mint-500/10 text-mint-500"
      : score >= 50
        ? "bg-trust-50 text-trust-700"
        : "bg-neutral-100 text-neutral-500";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>★ {score}</span>
  );
}

export default async function MyReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/my-reviews");

  const supabase = createSupabaseAdminClient();

  // 1. 내 앱 목록
  const { data: myApps } = await supabase
    .from("apps")
    .select("id, name")
    .eq("owner_user_id", user.id);

  const myAppIds = (myApps ?? []).map((a) => a.id);
  const myAppById = new Map((myApps ?? []).map((a) => [a.id, a]));

  // 2. 내 앱에 참여한 매칭 (pending/active/completed)
  const { data: incomingRaw } =
    myAppIds.length > 0
      ? await supabase
          .from("matches")
          .select("id, app_id, tester_user_id, matched_at, opted_in_at, status")
          .in("app_id", myAppIds)
          .in("status", ["pending", "active", "completed"])
          .neq("tester_user_id", user.id)
          .order("opted_in_at", { ascending: false, nullsFirst: false })
      : { data: [] as never[] };

  const incoming = incomingRaw ?? [];

  // 3. 고유 테스터 ID (순서 유지)
  const seenIds = new Set<number>();
  const testerIds: number[] = [];
  for (const m of incoming) {
    if (!seenIds.has(m.tester_user_id)) {
      seenIds.add(m.tester_user_id);
      testerIds.push(m.tester_user_id);
    }
  }

  // 4. 테스터 사용자 정보
  const { data: testerUsersRaw } =
    testerIds.length > 0
      ? await supabase
          .from("users")
          .select("id, nickname, trust_score")
          .in("id", testerIds)
      : { data: [] as never[] };
  const testerById = new Map(
    (testerUsersRaw ?? []).map((u) => [u.id, u]),
  );

  // 5. 테스터의 앱 (맞리뷰 대상)
  const { data: testerAppsRaw } =
    testerIds.length > 0
      ? await supabase
          .from("apps")
          .select("id, owner_user_id, name, status")
          .in("owner_user_id", testerIds)
          .in("status", ["matching", "reviewing"])
      : { data: [] as never[] };
  const testerApps = testerAppsRaw ?? [];

  // 6. 내가 이미 참여한 테스터 앱 ID 집합
  const testerAppIds = testerApps.map((a) => a.id);
  let myMatchedAppIds = new Set<number>();
  if (testerAppIds.length > 0) {
    const { data: myMatches } = await supabase
      .from("matches")
      .select("app_id")
      .eq("tester_user_id", user.id)
      .in("app_id", testerAppIds);
    myMatchedAppIds = new Set((myMatches ?? []).map((m) => m.app_id));
  }

  // 7. 테스터별 앱 그룹
  const appsByTester = new Map<number, typeof testerApps>();
  for (const a of testerApps) {
    const list = appsByTester.get(a.owner_user_id) ?? [];
    list.push(a);
    appsByTester.set(a.owner_user_id, list);
  }

  // 8. 표시용 행 (테스터 1명당 1행 — 가장 최근 참여 기준)
  const rows = testerIds.map((tid) => {
    const latestMatch = incoming.find((m) => m.tester_user_id === tid)!;
    const myApp = myAppById.get(latestMatch.app_id);
    const tester = testerById.get(tid);
    const theirApps = appsByTester.get(tid) ?? [];
    const mutualMatchedApp = theirApps.find((a) => myMatchedAppIds.has(a.id));
    const mutualDone = !!mutualMatchedApp;
    const mutualTarget = theirApps.find((a) => !myMatchedAppIds.has(a.id));
    return { tid, latestMatch, myApp, tester, mutualDone, mutualMatchedApp, mutualTarget, theirApps };
  });

  const totalTesters = rows.length;
  const mutualPossible = rows.filter((r) => !r.mutualDone && r.mutualTarget).length;
  const mutualDone = rows.filter((r) => r.mutualDone).length;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">맞리뷰</h1>
          <p className="mt-1 text-sm text-neutral-600">
            내 앱을 테스트해준 사람 목록. 상대방 앱도 테스트해주면 맞리뷰가 완성됩니다.
          </p>
          {totalTesters > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
              <span>참여자 {totalTesters}명</span>
              {mutualPossible > 0 && (
                <span className="font-semibold text-trust-600">맞리뷰 가능 {mutualPossible}건</span>
              )}
              {mutualDone > 0 && (
                <span className="text-mint-500">맞리뷰 완료 {mutualDone}건</span>
              )}
            </div>
          )}
        </header>

        <div className="mt-8">
          {rows.length === 0 ? (
            <EmptyState hasApps={myAppIds.length > 0} />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const cardBase =
                  "flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between";

                const innerContent = (
                  <>
                    {/* 테스터 정보 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {row.tester?.nickname ?? `사용자 #${row.tid}`}
                        </span>
                        {row.tester && <TrustBadge score={row.tester.trust_score} />}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        <span className="font-medium text-neutral-700">
                          {row.myApp?.name ?? "내 앱"}
                        </span>{" "}
                        테스트 참여 ·{" "}
                        {formatDate(row.latestMatch.opted_in_at ?? row.latestMatch.matched_at)}
                      </p>
                      {row.mutualDone && row.mutualMatchedApp && (
                        <p className="mt-0.5 text-xs text-neutral-400">
                          맞리뷰 앱:{" "}
                          <span className="font-medium text-neutral-500">
                            {row.mutualMatchedApp.name}
                          </span>
                        </p>
                      )}
                      {!row.mutualDone && row.mutualTarget && (
                        <Link
                          href={`/browse/${row.mutualTarget.id}`}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600 transition hover:border-trust-500 hover:bg-trust-50 hover:text-trust-700"
                        >
                          <span className="text-neutral-400">상대방 앱</span>
                          <span className="font-semibold">{row.mutualTarget.name}</span>
                          <span className="text-neutral-400">›</span>
                        </Link>
                      )}
                    </div>

                    {/* 맞리뷰 버튼/배지 */}
                    <div className="shrink-0">
                      {row.mutualDone ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mint-500/10 px-3 py-1.5 text-xs font-semibold text-mint-500">
                          맞리뷰 완료 ✓
                        </span>
                      ) : row.mutualTarget ? (
                        <Link
                          href={`/browse/${row.mutualTarget.id}`}
                          className="inline-flex rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
                        >
                          맞리뷰 하기 →
                        </Link>
                      ) : (
                        <span className="text-xs text-neutral-400">
                          {row.theirApps.length === 0 ? "상대방 앱 없음" : "모집 완료"}
                        </span>
                      )}
                    </div>
                  </>
                );

                // 맞리뷰 완료 — 카드 전체가 상대방 앱으로 이동하는 링크
                if (row.mutualDone && row.mutualMatchedApp) {
                  return (
                    <li key={row.tid}>
                      <Link
                        href={`/browse/${row.mutualMatchedApp.id}`}
                        className={`${cardBase} transition hover:border-trust-500 hover:shadow-md`}
                      >
                        {innerContent}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={row.tid} className={cardBase}>
                    {innerContent}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function EmptyState({ hasApps }: { hasApps: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
      {hasApps ? (
        <>
          <p className="text-base font-medium text-neutral-700">
            아직 내 앱을 테스트한 사람이 없습니다.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            매칭 가능 앱 목록에서 다른 앱을 먼저 테스트하면 맞리뷰가 자연스럽게 쌓입니다.
          </p>
          <Link
            href="/browse"
            className="mt-6 inline-flex rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
          >
            매칭 가능 앱 보기 →
          </Link>
        </>
      ) : (
        <>
          <p className="text-base font-medium text-neutral-700">등록한 앱이 없습니다.</p>
          <p className="mt-2 text-sm text-neutral-500">
            앱을 먼저 등록해야 맞리뷰를 받을 수 있습니다.
          </p>
          <Link
            href="/apps/new"
            className="mt-6 inline-flex rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
          >
            앱 등록하기 →
          </Link>
        </>
      )}
    </div>
  );
}
