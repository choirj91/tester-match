import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/state";
import { AppStatusBadge } from "@/app/apps/app-status-badge";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_ORDER, BROWSE_STATUSES } from "@/lib/app-status";
import { BrowseControls } from "./browse-controls";
import type { SortKey } from "./browse-controls";
import { PAID_SEAT_REWARD, countOpenSeatsByApp } from "@/lib/paid-seats";
import { SEAT_TOTAL_DAYS } from "@/lib/seat-reward-rules";

export const metadata = { title: "매칭 가능 앱" };

const PAGE_SIZE = 20;

type BrowseApp = {
  id: number;
  name: string;
  short_description: string;
  required_testers: number;
  is_boost: boolean;
  boost_deadline_at: string | null;
  created_at: string;
  status: string;
  owner_user_id: number;
  users_public_profile: { nickname: string } | { nickname: string }[] | null;
  /** 참여중(active) 테스터 수 — 목록 조회 뒤 따로 센다 */
  activeTesters?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 급구 표시가 끝날 때까지 남은 일수 (올림, 0 미만은 0) */
function boostDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS));
}

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

function SeatBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span title={`유료 시트 ${n}명 · ${SEAT_TOTAL_DAYS}일 완주 시 ${PAID_SEAT_REWARD} 크레딧`}>
      <Badge tone="ink">유료 시트 {n}</Badge>
    </span>
  );
}

function BoostBadge() {
  return <Badge tone="accent">급구</Badge>;
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

/** mono 꼬리 — 테스터 참여/필요 · 급구 남은 일수 · 등록자 · 등록일 */
function AppMeta({ app }: { app: BrowseApp }) {
  const owner = getOwner(app);
  const daysLeft = app.is_boost ? boostDaysLeft(app.boost_deadline_at) : null;
  return (
    <>
      테스터 {app.activeTesters ?? 0}/{app.required_testers}
      {daysLeft !== null && <> · 급구 남은 {daysLeft}일</>} · {owner?.nickname ?? "—"} ·{" "}
      {krDate(app.created_at)} 등록
    </>
  );
}

// ── 카드 뷰 ──────────────────────────────────────────────────────────

function CardGrid({ apps, seats }: { apps: BrowseApp[]; seats: Map<number, number> }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4 p-0">
      {apps.map((app) => {
        const openSeats = seats.get(app.id) ?? 0;
        return (
          <li key={app.id} className="flex">
            <AppCard
              className="w-full"
              highlighted={openSeats > 0}
              name={app.name}
              badges={
                <>
                  {app.is_boost && <BoostBadge />}
                  <SeatBadge n={openSeats} />
                  <AppStatusBadge status={app.status} />
                </>
              }
              description={<span className="line-clamp-2">{app.short_description}</span>}
              meta={<AppMeta app={app} />}
              action={
                <ButtonLink
                  href={`/browse/${app.id}`}
                  variant="secondary"
                  size="sm"
                  aria-label={`${app.name} 자세히 보기`}
                >
                  자세히 보기
                </ButtonLink>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

// ── 리스트 뷰 ─────────────────────────────────────────────────────────

function ListView({ apps, seats }: { apps: BrowseApp[]; seats: Map<number, number> }) {
  return (
    <ul className="m-0 list-none border-t border-ink-900 p-0">
      {apps.map((app) => {
        const openSeats = seats.get(app.id) ?? 0;
        return (
          <li key={app.id} className="border-b border-ink-200">
            <Link
              href={`/browse/${app.id}`}
              className="flex min-h-11 items-center gap-4 px-1 py-4 text-ink-900 no-underline hover:bg-surface-1"
            >
              <div className="w-16 shrink-0">
                <AppStatusBadge status={app.status} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-ink-900">{app.name}</span>
                  {app.is_boost && <BoostBadge />}
                  <SeatBadge n={openSeats} />
                </div>
                <p className="m-0 mt-0.5 truncate text-[13px] text-ink-700">{app.short_description}</p>
                <p className="m-0 mt-1 font-mono text-xs text-ink-600 tabular-nums">
                  <AppMeta app={app} />
                </p>
              </div>

              <ChevronRight className="size-4 shrink-0 text-ink-900" strokeWidth={1.8} aria-hidden="true" />
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
  const cell = "flex size-11 items-center justify-center font-mono text-sm tabular-nums";

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1" aria-label="페이지 이동">
      {/* 이전 */}
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          aria-label="이전 페이지"
          className={cx(cell, "border border-ink-900 bg-white text-ink-900 hover:bg-surface-1")}
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(cell, "border border-ink-200 text-ink-600")}>
          <ChevronLeft className="size-4" strokeWidth={1.8} />
        </span>
      )}

      {/* 페이지 번호 */}
      {pageNums.map((p, i) =>
        p === "..." ? (
          <span key={`dot-${i}`} className={cx(cell, "text-ink-600")}>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cx(
              cell,
              "border",
              p === page
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-200 bg-white text-ink-900 hover:border-ink-900",
            )}
          >
            {p}
          </Link>
        ),
      )}

      {/* 다음 */}
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          aria-label="다음 페이지"
          className={cx(cell, "border border-ink-900 bg-white text-ink-900 hover:bg-surface-1")}
        >
          <ChevronRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(cell, "border border-ink-200 text-ink-600")}>
          <ChevronRight className="size-4" strokeWidth={1.8} />
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
    "id, name, short_description, required_testers, is_boost, boost_deadline_at, created_at, status, owner_user_id, users_public_profile!inner(nickname)";

  // 급구 리스트 — 별도 조회 후 서버 랜덤 셔플, 페이지네이션과 무관하게 상단 고정
  const { data: boostRaw } = await supabase
    .from("apps")
    .select(SELECT_COLS)
    .in("status", BROWSE_STATUSES)
    .eq("is_boost", true);
  let boostApps = shuffle((boostRaw as BrowseApp[] | null) ?? []);

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

  // 앱별 참여중(active) 테스터 수 — 조회 실패 시 0 으로 보인다
  const listedIds = [...boostApps, ...apps].map((a) => a.id);
  const activeCounts = new Map<number, number>();
  if (listedIds.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("app_id")
      .in("app_id", listedIds)
      .eq("status", "active");
    for (const m of (matchRows as { app_id: number }[] | null) ?? []) {
      activeCounts.set(m.app_id, (activeCounts.get(m.app_id) ?? 0) + 1);
    }
  }
  const withCount = (a: BrowseApp): BrowseApp => ({ ...a, activeTesters: activeCounts.get(a.id) ?? 0 });
  boostApps = boostApps.map(withCount);
  apps = apps.map(withCount);

  // 조회 실패 시 배지만 숨긴다 (참여 자체는 서버가 다시 확인한다)
  const seats =
    (await countOpenSeatsByApp(
      supabase,
      [...boostApps, ...apps].map((a) => a.id),
    )) ?? new Map<number, number>();

  const total = nonBoostTotal + boostApps.length;

  const totalPages = Math.max(1, Math.ceil(nonBoostTotal / PAGE_SIZE));
  // page 범위 초과 시 1페이지로 리다이렉트
  if (page > totalPages && nonBoostTotal > 0) {
    redirect(`/browse?sort=${sort}&view=${view}`);
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[1200px] px-5 pt-10 pb-14">
        <header className="mb-8 flex flex-col gap-2">
          <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">매칭 가능 앱</h1>
          <p className="m-0 text-[15px] text-ink-700">
            테스터를 모집 중인 앱입니다. 앱을 골라 참여 링크를 확인하세요.
          </p>
        </header>

        {total > 0 ? (
          <>
            {boostApps.length > 0 && (
              <section
                aria-labelledby="boost-heading"
                className="mb-10 flex flex-col gap-4 border-[1.5px] border-accent-600 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <BoostBadge />
                  <h2 id="boost-heading" className="m-0 font-display text-h3 font-semibold text-ink-900">
                    급구 · <span className="font-mono tabular-nums">{boostApps.length}</span>
                  </h2>
                  <span className="text-xs text-ink-600">매번 랜덤 순서</span>
                  <Link
                    href="/paid-testers"
                    className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-900 underline hover:text-accent-600"
                  >
                    내 앱 급구 신청
                    <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                </div>
                {view === "card" ? <CardGrid apps={boostApps} seats={seats} /> : <ListView apps={boostApps} seats={seats} />}
              </section>
            )}
            <h2 className="sr-only">전체 앱</h2>
            <BrowseControls sort={sort} view={view} total={nonBoostTotal} page={page} totalPages={totalPages} />
            {view === "card" ? <CardGrid apps={apps} seats={seats} /> : <ListView apps={apps} seats={seats} />}
            <Pagination page={page} totalPages={totalPages} sort={sort} view={view} />
          </>
        ) : (
          <EmptyState title="현재 매칭중인 앱이 없습니다." description="잠시 후 다시 확인해주세요." />
        )}
      </main>
    </>
  );
}
