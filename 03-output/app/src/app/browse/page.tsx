import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "매칭 가능 앱" };

export default async function BrowsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/browse");

  const supabase = createSupabaseAdminClient();
  const { data: apps } = await supabase
    .from("apps")
    .select(
      "id, name, short_description, required_testers, is_boost, created_at, owner_user_id, users_public_profile!inner(nickname, trust_score)",
    )
    .eq("status", "matching")
    .order("is_boost", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">매칭 가능 앱</h1>
          <p className="mt-1 text-sm text-neutral-600">
            현재 테스터를 모집중인 앱입니다. 관심 가는 앱이 있으면 카드를 클릭해 참여 링크를 확인하세요.
          </p>
        </header>

        {apps && apps.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {apps.map((app) => {
              const owner = Array.isArray(app.users_public_profile)
                ? app.users_public_profile[0]
                : app.users_public_profile;
              return (
                <li key={app.id}>
                  <Link
                    href={`/browse/${app.id}`}
                    className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-trust-600 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="truncate text-lg font-semibold text-neutral-900">
                        {app.name}
                      </h2>
                      {app.is_boost && (
                        <span className="shrink-0 rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          BOOST
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                      {app.short_description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                      <span className="tabular">
                        남은 테스터{" "}
                        <strong className="text-trust-600">{app.required_testers}</strong>명
                      </span>
                      <span>·</span>
                      <span>
                        등록자 <strong className="text-neutral-700">{owner?.nickname ?? "—"}</strong>
                      </span>
                      <span>·</span>
                      <span className="tabular">신뢰 {owner?.trust_score ?? 50}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <p className="text-base font-medium text-neutral-700">
              현재 매칭중인 앱이 없습니다.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              잠시 후 다시 확인해주세요.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
