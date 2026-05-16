import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, APP_STATUS_ORDER, BROWSE_STATUSES } from "@/lib/app-status";
import type { AppStatus } from "@/lib/app-status";
import { BrowseControls } from "./browse-controls";
import type { SortKey } from "./browse-controls";

export const runtime = "edge";
export const metadata = { title: "매칭 가능 앱" };

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

function sortApps(apps: BrowseApp[], sort: SortKey): BrowseApp[] {
  const sorted = [...apps].sort((a, b) => {
    // Boost 항상 최상단
    if (a.is_boost !== b.is_boost) return a.is_boost ? -1 : 1;

    switch (sort) {
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "testers":
        return b.required_testers - a.required_testers;
      case "status":
        return (APP_STATUS_ORDER[a.status] ?? 9) - (APP_STATUS_ORDER[b.status] ?? 9);
      default: // newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
  return sorted;
}

function krDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const label = APP_STATUS_LABEL[status as AppStatus] ?? { text: status, tone: "bg-neutral-100 text-neutral-500" };
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
                <span>
                  {owner?.nickname ?? "—"}
                </span>
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
              {/* 상태 */}
              <div className="w-16 shrink-0">
                <StatusBadge status={app.status} />
              </div>

              {/* 앱 이름 + 설명 */}
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

              {/* 메타 */}
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

// ── 메인 페이지 ───────────────────────────────────────────────────────

const VALID_SORTS: SortKey[] = ["newest", "oldest", "testers", "status"];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/browse");

  const { sort: sortParam = "newest", view: viewParam = "card" } = await searchParams;
  const sort: SortKey = VALID_SORTS.includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "newest";
  const view = viewParam === "list" ? "list" : "card";

  const supabase = createSupabaseAdminClient();
  const { data: rawApps } = await supabase
    .from("apps")
    .select(
      "id, name, short_description, required_testers, is_boost, created_at, status, owner_user_id, users_public_profile!inner(nickname)",
    )
    .in("status", BROWSE_STATUSES)
    .limit(100);

  const apps = sortApps((rawApps as BrowseApp[] | null) ?? [], sort);

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

        {apps.length > 0 ? (
          <>
            <BrowseControls sort={sort} view={view} count={apps.length} />
            {view === "card" ? <CardGrid apps={apps} /> : <ListView apps={apps} />}
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
