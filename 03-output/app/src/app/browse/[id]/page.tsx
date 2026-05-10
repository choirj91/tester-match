import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";
import { OptInButton } from "./opt-in-button";
import { AppCommentsSection } from "./comments-section";

export const runtime = 'edge';

type Props = { params: Promise<{ id: string }> };

export default async function BrowseDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/browse/${id}`);
  }

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();

  const [{ data: app }, { data: existingMatch }, { count: activeCount }, { data: comments }, { data: ownAppsForPromote }] =
    await Promise.all([
      supabase
        .from("apps")
        .select(
          "id, name, short_description, store_invite_url, web_invite_url, google_group_url, status, is_boost, created_at, owner_user_id, users_public_profile!inner(nickname, trust_score)",
        )
        .eq("id", appId)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id")
        .eq("app_id", appId)
        .eq("tester_user_id", user.id)
        .in("status", ["pending", "active"])
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("app_id", appId)
        .eq("status", "active"),
      supabase
        .from("app_comments")
        .select(
          "id, body, created_at, author_user_id, promoted_app_id, users_public_profile!inner(nickname)",
        )
        .eq("app_id", appId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("apps")
        .select("id, name, status")
        .eq("owner_user_id", user.id)
        .in("status", ["matching", "reviewing", "launched"])
        .neq("id", appId)
        .order("created_at", { ascending: false }),
    ]);

  if (!app) notFound();

  const owner = Array.isArray(app.users_public_profile)
    ? app.users_public_profile[0]
    : app.users_public_profile;
  const isOwn = app.owner_user_id === user.id;
  const joined = !!existingMatch;
  const linksRevealed = joined || isOwn;
  const statusLabel = APP_STATUS_LABEL[(app.status as AppStatus) ?? "matching"];

  // promoted_app_id → 이름 매핑 (한 번에 fetch)
  const promotedIds = (comments ?? [])
    .map((c) => c.promoted_app_id)
    .filter((v): v is number => v != null);
  const promotedAppMap: Record<number, string> = {};
  if (promotedIds.length > 0) {
    const { data: promotedApps } = await supabase
      .from("apps")
      .select("id, name")
      .in("id", promotedIds);
    for (const p of promotedApps ?? []) {
      promotedAppMap[p.id] = p.name;
    }
  }

  const enrichedComments = (comments ?? []).map((c) => {
    const author = Array.isArray(c.users_public_profile)
      ? c.users_public_profile[0]
      : c.users_public_profile;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author_user_id: c.author_user_id,
      author_nickname: author?.nickname ?? "—",
      promoted_app_id: c.promoted_app_id,
      promoted_app_name: c.promoted_app_id ? (promotedAppMap[c.promoted_app_id] ?? null) : null,
    };
  });

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/browse" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 매칭 가능
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-neutral-900">{app.name}</h1>
          {app.is_boost && (
            <span className="shrink-0 rounded-full bg-spark-500 px-3 py-1 text-xs font-bold uppercase text-white">
              BOOST
            </span>
          )}
        </div>

        <p className="mt-3 text-base leading-relaxed text-neutral-700">
          {app.short_description}
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <Stat label="참여중" value={`${activeCount ?? 0}명`} />
          <Stat
            label="상태"
            value={statusLabel.text}
            tone={statusLabel.tone}
          />
          <Stat label="등록자" value={owner?.nickname ?? "—"} />
          <Stat label="등록일" value={new Date(app.created_at).toLocaleDateString("ko-KR")} />
        </dl>

        {/* Google 그룹 가입 안내 — 링크 공개 전후 모두 표시 */}
        {app.google_group_url && (
          <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                1단계
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-amber-900">
                  Google 그룹에 먼저 가입하세요
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  Google Play Closed Testing은 지정된 Google 그룹 구성원만 초대 링크를 사용할 수
                  있습니다. 아래 링크로 그룹에 가입한 후 테스트 참여 버튼을 눌러주세요.
                </p>
                <a
                  href={app.google_group_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Google 그룹 가입하기 →
                </a>
              </div>
            </div>
          </section>
        )}

        <section className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm ${app.google_group_url ? "mt-4" : "mt-10"}`}>
          <div className="flex items-center gap-2">
            {app.google_group_url && (
              <span className="shrink-0 rounded-full bg-trust-600 px-2 py-0.5 text-[10px] font-bold text-white">
                2단계
              </span>
            )}
            <h2 className="text-lg font-semibold text-neutral-900">
              {app.google_group_url ? "테스트 참여 신청" : "참여하기"}
            </h2>
          </div>

          {linksRevealed ? (
            <>
              <p className="mt-1 text-sm text-neutral-600">
                {isOwn
                  ? "본인 앱입니다. 등록한 링크를 확인합니다."
                  : "본인 디바이스에서 아래 링크로 Closed Testing에 가입하세요. 14일 카운트가 시작됩니다."}
              </p>
              <div className="mt-5 space-y-3">
                <LinkRow label="안드로이드" url={app.store_invite_url} />
                <LinkRow label="웹 (브라우저)" url={app.web_invite_url} />
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center">
              <p className="text-sm font-medium text-neutral-700">
                안드로이드 / 웹 초대 링크는 참여 후 공개됩니다.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                참여하면 14일 카운트가 시작되고, 매칭 완주 시 800 크레딧이 적립됩니다.
              </p>
            </div>
          )}

          {!isOwn && (
            <div className="mt-6">
              <OptInButton
                appId={app.id}
                alreadyJoined={joined}
                isOwn={false}
                isFull={false}
              />
            </div>
          )}
        </section>

        <AppCommentsSection
          appId={app.id}
          currentUserId={user.id}
          initialComments={enrichedComments}
          ownPromotableApps={(ownAppsForPromote ?? []).map((a) => ({
            id: a.id,
            name: a.name,
          }))}
        />
      </main>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd
        className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-base font-semibold tabular ${
          tone ?? "text-neutral-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="text-sm text-neutral-400">
        <strong className="font-semibold">{label}:</strong> 미등록
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-sm font-semibold text-neutral-700">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm text-trust-600 underline hover:text-trust-700"
      >
        {url}
      </a>
    </div>
  );
}
