import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DeleteAppButton } from "./delete-app-button";

type Props = { params: Promise<{ id: string }> };

const STATUS_LABEL: Record<string, string> = {
  draft: "대기",
  matching: "매칭 진행중",
  completed: "완료",
  paused: "일시정지",
  deleted: "삭제됨",
};

const MATCH_STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  active: { text: "진행중", tone: "bg-trust-50 text-trust-700" },
  completed: { text: "완주", tone: "bg-mint-500/10 text-mint-500" },
  opted_out: { text: "옵트아웃", tone: "bg-neutral-100 text-neutral-500" },
  penalized: { text: "페널티", tone: "bg-crimson-500/10 text-crimson-500" },
  pending: { text: "대기", tone: "bg-neutral-100 text-neutral-700" },
};

function dayCount(optedInAt: string | null): number {
  if (!optedInAt) return 0;
  const start = new Date(optedInAt).getTime();
  const days = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
  return Math.min(Math.max(days, 0), 14);
}

export default async function AppDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/apps/${id}`);
  }

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select(
      "id, owner_user_id, name, short_description, store_invite_url, web_invite_url, required_testers, status, created_at, updated_at",
    )
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!app) notFound();

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, status, opted_in_at, tester_user_id, users_public_profile!inner(nickname, trust_score)",
    )
    .eq("app_id", appId)
    .order("opted_in_at", { ascending: false });

  const activeCount = matches?.filter((m) => m.status === "active").length ?? 0;
  const completedCount = matches?.filter((m) => m.status === "completed").length ?? 0;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/apps" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 내 앱
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{app.name}</h1>
            <p className="mt-2 text-sm text-neutral-600">
              {STATUS_LABEL[app.status] ?? app.status}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/apps/${app.id}/edit`}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              수정
            </Link>
            <DeleteAppButton id={app.id} />
          </div>
        </div>

        <p className="mt-6 text-base leading-relaxed text-neutral-700">
          {app.short_description}
        </p>

        <dl className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="남은 테스터" value={`${app.required_testers}명`} />
          <Stat label="진행중" value={`${activeCount}명`} />
          <Stat label="완주" value={`${completedCount}명`} />
        </dl>

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">참여 링크</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Row label="안드로이드" url={app.store_invite_url} />
            <Row label="웹 참여" url={app.web_invite_url} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-900">
            참여중인 테스터 <span className="tabular text-neutral-500">{matches?.length ?? 0}</span>
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {matches && matches.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {matches.map((m) => {
                  const tester = Array.isArray(m.users_public_profile)
                    ? m.users_public_profile[0]
                    : m.users_public_profile;
                  const label = MATCH_STATUS_LABEL[m.status] ?? MATCH_STATUS_LABEL.pending;
                  const days = dayCount(m.opted_in_at);

                  return (
                    <li
                      key={m.id}
                      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {tester?.nickname ?? "—"}
                        </p>
                        <p className="text-xs text-neutral-500">
                          신뢰 <span className="tabular">{tester?.trust_score ?? 50}</span>
                          {m.opted_in_at && (
                            <>
                              {" · "}
                              <span className="tabular">{days}</span>일차 / 14일
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${label.tone}`}
                      >
                        {label.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-neutral-500">
                아직 참여한 테스터가 없습니다.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-neutral-900 tabular">{value}</dd>
    </div>
  );
}

function Row({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <p className="text-neutral-400">
        <strong className="font-semibold">{label}:</strong> 미등록
      </p>
    );
  }
  return (
    <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <strong className="shrink-0 font-semibold text-neutral-700">{label}</strong>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-trust-600 underline hover:text-trust-700"
      >
        {url}
      </a>
    </p>
  );
}
