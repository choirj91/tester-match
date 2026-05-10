import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/site-header";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";

export const runtime = 'edge';

export const metadata = { title: "내 앱" };

export default async function AppsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/apps");

  const supabase = createSupabaseAdminClient();
  const { data: apps } = await supabase
    .from("apps")
    .select("id, name, status, short_description, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  // 본인 앱별 active 매칭 수 (참여중)
  const ids = (apps ?? []).map((a) => a.id);
  const counts = new Map<number, number>();
  if (ids.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("app_id")
      .in("app_id", ids)
      .eq("status", "active");
    for (const m of matchRows ?? []) {
      counts.set(m.app_id, (counts.get(m.app_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">내 앱</h1>
            <p className="mt-1 text-sm text-neutral-600">
              등록한 앱과 진행 상태를 한 화면에서 관리합니다.
            </p>
          </div>
          <Link
            href="/apps/new"
            className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
          >
            + 앱 등록
          </Link>
        </div>

        <div className="mt-8">
          {apps && apps.length > 0 ? (
            <ul className="space-y-3">
              {apps.map((app) => {
                const label =
                  APP_STATUS_LABEL[(app.status as AppStatus) ?? "draft"] ??
                  APP_STATUS_LABEL.draft;
                const activeCount = counts.get(app.id) ?? 0;
                return (
                  <li
                    key={app.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                  >
                    <Link href={`/apps/${app.id}`} className="block">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold text-neutral-900">
                            {app.name}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                            {app.short_description}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${label.tone}`}
                        >
                          {label.text}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                        <span className="tabular">
                          <strong className="text-trust-600">{activeCount}</strong>명 참여중
                        </span>
                        <span>·</span>
                        <span className="tabular">
                          등록일{" "}
                          {new Date(app.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <p className="text-base font-medium text-neutral-700">
                아직 등록된 앱이 없습니다.
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                첫 앱을 등록하면 매칭 큐에 진입합니다.
              </p>
              <Link
                href="/apps/new"
                className="mt-6 inline-flex rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                + 앱 등록
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
