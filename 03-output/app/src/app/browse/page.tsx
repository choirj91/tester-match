import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, APP_STATUS_ORDER, BROWSE_STATUSES } from "@/lib/app-status";
import type { AppStatus } from "@/lib/app-status";
import { BrowseControls } from "./browse-controls";
import type { SortKey } from "./browse-controls";
import { AdUnit } from "@/components/ad-unit";

export const runtime = "edge";
export const metadata = { title: "매칭 가능 앱" };

const PAGE_SIZE = 20;

type BrowseApp = {
  id: number;
  name: string;
  short_description: string;
  required_testers: number;
  is_boost: boolean;
  created_at: string;
  status: string;
  owner_user_id: number;
  users_public_profile: { nickname: string } | { nickname: string }[] | null;
};

function getOwner(app: BrowseApp) {
  if (!app.users_public_profile) return null;
  return Array.isArray(app.users_public_profile)
    ? app.users_public_profile[0]
    : app.users_public_profile;
}

/** status 정렬만 JS에서 처리 (APP_STATUS_ORDER 커스텀 매핑) */
function sortByStatus(apps: BrowseApp[]): BrowseApp[] {
  return [...apps].sort((a, b) => {
    if (a.is_boost !== b.is_boost) return a.is_boost ? -1 : 1;
    return (APP_STATUS_ORDER[a.status] ?? 9) - (APP_STATUS_ORDER[b.status] ?? 9);
  });
}

// Fisher-Yates 셔플 (요청마다 서버 렌더 → 매 방문 새 순서)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const nums: (number | "...")[] = [1];
  if (current > 3) nums.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) nums.push(i);
  if (current < total - 2) nums.push("...");
  nums.push(total);
  return nums;
}

function krDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const label = APP_STATUS_LABEL[status as AppStatus] ?? {
    text: status,
    tone: "bg-neutral-100 text-neutral-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${label.tone}`}>
      {label.text}
    </span>
  );
}

// ── 카드 뷰 ──────────────────────────────────────────────────────────

function CardGrid({ apps }: { apps: BrowseApp[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => {
        const owner = getOwner(app);
        return (
          <li key={app.id}>
            <Link
              href={`/browse/${app.id}`}
              className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-trust-600 hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="truncate text-base font-semibold text-neutral-900">{app.name}</h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  {app.is_boost && (
                    <span className="rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      BOOST
                    </span>
                  )}
                  <StatusBadge status={app.status} />
                </div>
              </div>

              <p className="mt-2 line-clamp-2 flex-1 text-sm text-neutral-600">
                {app.short_description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                <span className="tabular">
                  테스터 <strong className="text-trust-600">{app.required_testers}</strong>명
                </span>
                <span>·</span>
                <span>{owner?.nickname ?? "—"}</span>
                <span>·</span>
                <span className="tabular">{krDate(app.created_at)} 등록</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── 리스트 뷰 ─────────────────────────────────────────────────────────

function ListView({ apps }: { apps: BrowseApp[] }) {
  return (
    <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {apps.map((app) => {
        const owner = getOwner(app);
        return (
          <li key={app.id}>
            <Link
              href={`/browse/${app.id}`}
              className="flex items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
            >
              <div className="w-16 shrink-0">
                <StatusBadge status={app.status} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-neutral-900">{app.name}</span>
                  {app.is_boost && (
                    <span className="shrink-0 rounded-full bg-spark-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      BOOST
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">{app.short_description}</p>
              </div>

              <div className="hidden shrink-0 items-center gap-4 text-xs text-neutral-500 sm:flex">
                <span className="tabular">
                  <strong className="text-trust-600">{app.required_testers}</strong>명
                </span>
                <span>{owner?.nickname ?? "—"}</span>
                <span className="tabular">{krDate(app.created_at)}</span>
              </div>

              <span className="shrink-0 text-neutral-300">›</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── 페이지네이션 ──────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  sort,
  view,
}: {
  page: number;
  totalPages: number;
  sort: SortKey;
  view: string;
}) {
  if (totalPages <= 1) return null;

  function href(p: number) {
    const params = new URLSearchParams({ sort, view, page: String(p) });
    return `/browse?${params.toString()}`;
  }

  const pageNums = getPageNumbers(page, totalPages);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="페이지 이동">
      {/* 이전 */}
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm text-neutral-600 hover:bg-neutral-50"
        >
          ‹
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-100 text-sm text-neutral-300">
          ‹
        </span>
      )}

      {/* 페이지 번호 */}
      {pageNums.map((p, i) =>
        p === "..." ? (
          <span
            key={`dot-${i}`}
            className="flex h-9 w-9 items-center justify-center text-sm text-neutral-400"
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition ${
              p === page
                ? "border-trust-600 bg-trust-600 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {p}
          </Link>
        ),
      )}

      {/* 다음 */}
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm text-neutral-600 hover:bg-neutral-50"
        >
          ›
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-100 text-sm text-neutral-300">
          ›
        </span>
      )}
    </nav>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────

const VALID_SORTS: SortKey[] = ["newest", "oldest", "testers", "status"];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; view?: string; page?: string }>;
}) {
  const user = await getCurrentUser();

  const { sort: sortParam = "newest", view: viewParam = "card", page: pageParam } =
    await searchParams;

  const sort: SortKey = VALID_SORTS.includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "newest";
  const view = viewParam === "list" ? "list" : "card";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = createSupabaseAdminClient();

  const SELECT_COLS =
    "id, name, short_description, required_testers, is_boost, created_at, status, owner_user_id, users_public_profile!inner(nickname)";

  // 급구 리스트 — 별도 조회 후 서버 랜덤 셔플, 페이지네이션과 무관하게 상단 고정
  const { data: boostRaw } = await supabase
    .from("apps")
    .select(SELECT_COLS)
    .in("status", BROWSE_STATUSES)
    .eq("is_boost", true);
  const boostApps = shuffle((boostRaw as BrowseApp[] | null) ?? []);

  // 비-급구 리스트 — 기존 정렬 + 페이지네이션
  let apps: BrowseApp[];
  let nonBoostTotal: number;

  if (sort === "status") {
    const { data, count } = await supabase
      .from("apps")
      .select(SELECT_COLS, { count: "exact" })
      .in("status", BROWSE_STATUSES)
      .eq("is_boost", false)
      .order("created_at", { ascending: false });

    const sorted = sortByStatus((data as BrowseApp[] | null) ?? []);
    nonBoostTotal = count ?? sorted.length;
    apps = sorted.slice(offset, offset + PAGE_SIZE);
  } else {
    const ascending = sort === "oldest";
    const column = sort === "testers" ? "required_testers" : "created_at";

    const { data, count } = await supabase
      .from("apps")
      .select(SELECT_COLS, { count: "exact" })
      .in("status", BROWSE_STATUSES)
      .eq("is_boost", false)
      .order(column, { ascending })
      .range(offset, offset + PAGE_SIZE - 1);

    nonBoostTotal = count ?? 0;
    apps = (data as BrowseApp[] | null) ?? [];
  }

  const total = nonBoostTotal + boostApps.length;

  const totalPages = Math.max(1, Math.ceil(nonBoostTotal / PAGE_SIZE));
  // page 범위 초과 시 1페이지로 리다이렉트
  if (page > totalPages && nonBoostTotal > 0) {
    redirect(`/browse?sort=${sort}&view=${view}`);
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">매칭 가능 앱</h1>
          <p className="mt-1 text-sm text-neutral-600">
            테스터를 모집 중인 앱입니다. 카드를 클릭해 참여 링크를 확인하세요.
          </p>
        </header>

        {total > 0 ? (
          <>
            {boostApps.length > 0 && (
              <section className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    🔥 BOOST
                  </span>
                  <h2 className="text-sm font-bold text-neutral-900">
                    급구 · <span className="tabular text-neutral-500">{boostApps.length}</span>
                  </h2>
                  <span className="text-[11px] text-neutral-400">매번 랜덤 순서</span>
                </div>
                {view === "card" ? <CardGrid apps={boostApps} /> : <ListView apps={boostApps} />}
              </section>
            )}
            <BrowseControls sort={sort} view={view} total={nonBoostTotal} page={page} totalPages={totalPages} />
            {view === "card" ? <CardGrid apps={apps} /> : <ListView apps={apps} />}
            <Pagination page={page} totalPages={totalPages} sort={sort} view={view} />
            <AdUnit slot="browseList" />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <p className="text-base font-medium text-neutral-700">현재 매칭중인 앱이 없습니다.</p>
            <p className="mt-2 text-sm text-neutral-600">잠시 후 다시 확인해주세요.</p>
          </div>
        )}
      </main>
    </>
  );
}
