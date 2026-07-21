import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { OptInButton } from "./opt-in-button";
import { AppCommentsSection } from "./comments-section";
import { AdminBadge } from "@/components/admin-badge";
import { PlayGroupJoinPrompt } from "@/components/play-group-join-prompt";

export const runtime = 'edge';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) return {};
  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select("id, name, short_description, status")
    .eq("id", appId)
    .maybeSingle();
  if (!app || app.status === "deleted" || app.status === "draft") return {};
  const title = `${app.name} — 안드로이드 비공개 테스터 모집`;
  const description = (app.short_description ?? "").slice(0, 155) || `${app.name} 앱의 Google Play 비공개 테스터를 모집 중입니다.`;
  return {
    title,
    description,
    alternates: { canonical: `/browse/${appId}` },
    openGraph: { title, description, url: `https://tester-match.pages.dev/browse/${appId}`, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BrowseDetailPage({ params }: Props) {
  const user = await getCurrentUser();

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();

  const userId = user?.id ?? -1; // 로그인 안 되어 있을 때 무의미 값으로 필터링

  const [{ data: app }, { data: existingMatch }, { count: activeCount }, { data: comments }, { data: ownAppsForPromote }] =
    await Promise.all([
      supabase
        .from("apps")
        .select(
          "id, name, short_description, store_invite_url, web_invite_url, google_group_url, status, is_boost, created_at, owner_user_id, users_public_profile!inner(nickname, trust_score)",
        )
        .eq("id", appId)
        .maybeSingle(),
      user
        ? supabase
            .from("matches")
            .select("id")
            .eq("app_id", appId)
            .eq("tester_user_id", userId)
            .in("status", ["pending", "active"])
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("app_id", appId)
        .eq("status", "active"),
      supabase
        .from("app_comments")
        .select(
          "id, body, created_at, author_user_id, promoted_app_id, users_public_profile!inner(nickname, role)",
        )
        .eq("app_id", appId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      user
        ? supabase
            .from("apps")
            .select("id, name, status")
            .eq("owner_user_id", userId)
            .in("status", ["matching", "reviewing", "launched"])
            .neq("id", appId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<{ id: number; name: string; status: string }> }),
    ]);

  if (!app || app.status === "deleted") notFound();

  const owner = Array.isArray(app.users_public_profile)
    ? app.users_public_profile[0]
    : app.users_public_profile;
  const isOwn = !!user && app.owner_user_id === user.id;
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
      author_role: author?.role,
      promoted_app_id: c.promoted_app_id,
      promoted_app_name: c.promoted_app_id ? (promotedAppMap[c.promoted_app_id] ?? null) : null,
    };
  });

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.short_description,
    applicationCategory: "MobileApplication",
    operatingSystem: "ANDROID",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KRW",
    },
    author: { "@type": "Person", name: owner?.nickname ?? "Tester Match 사용자" },
    datePublished: app.created_at,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
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

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">참여하기</h2>

          {/* ── Google 그룹 안내 ── */}
          {app.google_group_url === TESTER_GROUP_URL && user ? (
            // 공용 그룹 + 로그인 → 1클릭 가입 안내 (이미 가입했으면 무시)
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  1단계 필수
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    공용 테스터 그룹에 가입해주세요 (최초 1회)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    이 앱은 공용 그룹 <strong>{PLAY_GROUP_EMAIL}</strong> 을 사용합니다.
                    한 번 가입하면 모든 앱의 테스트에 참여할 수 있습니다. Google Play 에서
                    쓰는 것과 동일한 계정으로 가입해주세요. 이미 가입했다면 바로 아래
                    초대 링크를 사용하세요.
                  </p>
                  <PlayGroupJoinPrompt compact />
                </div>
              </div>
            </div>
          ) : app.google_group_url === TESTER_GROUP_URL ? (
            // 공용 그룹 + 비로그인 → 로그인 유도
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  1단계 필수
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    로그인 후 공용 테스터 그룹에 가입하세요 (가입은 1클릭)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    이 앱은 공용 테스터 그룹({PLAY_GROUP_EMAIL})을 사용합니다. 그룹 가입
                    한 번이면 Tester Match 의 모든 앱 테스트에 참여할 수 있습니다.
                  </p>
                  <Link
                    href={`/auth/login?next=/browse/${app.id}`}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    Google로 시작하기 →
                  </Link>
                </div>
              </div>
            </div>
          ) : app.google_group_url ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  1단계 필수
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">Google 그룹에 먼저 가입하세요</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    Google Play Closed Testing은 지정된 Google 그룹 구성원만 초대 링크를 사용할
                    수 있습니다. 그룹 가입 없이 초대 링크를 열면 오류가 발생합니다.
                  </p>
                  <a
                    href={app.google_group_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    Google 그룹 가입하기 →
                  </a>
                </div>
              </div>
            </div>
          ) : user ? (
            // 그룹 미설정 앱 — 공용 그룹 가입을 소프트하게 유도 (테스터 전용 유저 접점)
            <div className="mt-4 rounded-xl border border-trust-500/30 bg-trust-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-trust-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  추천
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">
                    공용 테스터 그룹에 미리 가입해두세요 (최초 1회)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                    Tester Match 앱 대부분이 공용 그룹 <strong>{PLAY_GROUP_EMAIL}</strong> 으로
                    테스터를 승인합니다. 한 번 가입해두면 앞으로 어떤 앱이든 바로 참여할 수
                    있습니다. Google Play 와 동일한 계정으로 가입해주세요.
                  </p>
                  <PlayGroupJoinPrompt compact />
                </div>
              </div>
            </div>
          ) : null}

          {/* ── 초대 링크 (그룹 가입 후 2단계 / 그룹 없으면 바로) ── */}
          {linksRevealed ? (
            <div className="mt-4">
              {app.google_group_url && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-trust-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    2단계
                  </span>
                  <p className="text-xs text-neutral-500">
                    그룹 가입 완료 후 아래 링크로 Closed Testing에 참여하세요.
                  </p>
                </div>
              )}
              {!app.google_group_url && !isOwn && (
                <p className="mb-3 text-sm text-neutral-600">
                  본인 디바이스에서 아래 링크로 Closed Testing에 가입하세요.
                </p>
              )}
              {isOwn && (
                <p className="mb-3 text-sm text-neutral-600">본인 앱입니다. 등록한 링크를 확인합니다.</p>
              )}
              <div className="space-y-3">
                <LinkRow label="안드로이드" url={app.store_invite_url} />
                <LinkRow label="웹 (브라우저)" url={app.web_invite_url} />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center">
              <p className="text-sm font-medium text-neutral-700">
                {app.google_group_url
                  ? "그룹 가입 후 참여 신청하면 초대 링크가 공개됩니다."
                  : "초대 링크는 참여 신청 후 공개됩니다."}
              </p>
              <p className="mt-1 text-xs text-neutral-500">정식 출시 후 보상 안내 예정입니다.</p>
            </div>
          )}

          {!isOwn && user && (
            <div className="mt-6">
              <OptInButton
                appId={app.id}
                alreadyJoined={joined}
                isOwn={false}
                isFull={false}
              />
            </div>
          )}
          {!user && (
            <div className="mt-6">
              <Link
                href={`/auth/login?next=/browse/${app.id}`}
                className="inline-flex rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                로그인하고 참여하기 →
              </Link>
            </div>
          )}
        </section>

        {user ? (
          <AppCommentsSection
            appId={app.id}
            currentUserId={user.id}
            initialComments={enrichedComments}
            ownPromotableApps={(ownAppsForPromote ?? []).map((a) => ({
              id: a.id,
              name: a.name,
            }))}
          />
        ) : (
          <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">
              댓글 <span className="tabular text-neutral-500">{enrichedComments.length}</span>
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              댓글을 작성하려면 로그인이 필요합니다.
            </p>
            {enrichedComments.length > 0 && (
              <ul className="mt-4 divide-y divide-neutral-100">
                {enrichedComments.slice(0, 10).map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                      {c.author_nickname}
                      {c.author_role === "admin" && <AdminBadge />}
                    </p>
                    <p className="mt-1 text-sm text-neutral-800 whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
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
