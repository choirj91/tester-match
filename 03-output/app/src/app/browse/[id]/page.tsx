import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { OptInButton } from "./opt-in-button";
import { countOpenSeatsByApp } from "@/lib/paid-seats";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";
import { AppCommentsSection } from "./comments-section";
import { AdminBadge } from "@/components/admin-badge";
import { PlayGroupJoinPrompt } from "@/components/play-group-join-prompt";

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
    // 앱 상세는 스토어 설명을 그대로 싣는 기능 페이지라 색인에서 제외한다.
    // (AdSense "가치 없는 콘텐츠" 대응 — 링크는 계속 따라가도록 follow 유지)
    robots: { index: false, follow: true },
    alternates: { canonical: `/browse/${appId}` },
    openGraph: { title, description, url: `https://tester-match.knockknock.company/browse/${appId}`, type: "article" },
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

  // 유료 시트 (ADR-0012) — 열린 시트가 있으면 참여 시 시트로 우선 배정된다
  const openSeats =
    app.status === "matching" ? ((await countOpenSeatsByApp(supabase, [appId]))?.get(appId) ?? 0) : 0;

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
      <main className="mx-auto max-w-[760px] px-5 pt-8 pb-14">
        <Link
          href="/browse"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-700 hover:text-accent-600"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
          매칭 가능
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">{app.name}</h1>
          {app.is_boost && <Badge tone="accent" className="shrink-0">급구</Badge>}
        </div>

        <p className="m-0 mt-3 text-base leading-relaxed text-ink-700">{app.short_description}</p>

        <StatTiles className="mt-8">
          <StatTile rule label="참여중" value={<span className="font-mono">{`${activeCount ?? 0}명`}</span>} />
          <StatTile rule label="상태" value={statusLabel.text} />
          <StatTile rule label="등록자" value={owner?.nickname ?? "—"} />
          <StatTile
            rule
            label="등록일"
            value={<span className="font-mono">{new Date(app.created_at).toLocaleDateString("ko-KR")}</span>}
          />
        </StatTiles>

        <section aria-labelledby="join-heading" className="mt-12 flex flex-col gap-4 border-t border-ink-900 pt-8">
          <h2 id="join-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
            참여하기
          </h2>

          {/* ── Google 그룹 안내 ── */}
          {app.google_group_url === TESTER_GROUP_URL && user ? (
            // 공용 그룹 + 로그인 → 1클릭 가입 안내 (이미 가입했으면 무시)
            <Notice kind="caution" title={<StepTitle step="1단계 필수">공용 테스터 그룹에 가입해주세요 (최초 1회)</StepTitle>}>
              <p className="m-0">
                이 앱은 공용 그룹 <strong className="font-mono">{PLAY_GROUP_EMAIL}</strong> 을 사용합니다.
                한 번 가입하면 모든 앱의 테스트에 참여할 수 있습니다. Google Play 에서
                쓰는 것과 동일한 계정으로 가입해주세요. 이미 가입했다면 바로 아래
                초대 링크를 사용하세요.
              </p>
              <PlayGroupJoinPrompt compact />
            </Notice>
          ) : app.google_group_url === TESTER_GROUP_URL ? (
            // 공용 그룹 + 비로그인 → 로그인 유도
            <Notice
              kind="caution"
              title={<StepTitle step="1단계 필수">로그인 후 공용 테스터 그룹에 가입하세요 (가입은 1클릭)</StepTitle>}
            >
              <p className="m-0">
                이 앱은 공용 테스터 그룹(<span className="font-mono">{PLAY_GROUP_EMAIL}</span>)을 사용합니다. 그룹 가입
                한 번이면 Tester Match 의 모든 앱 테스트에 참여할 수 있습니다.
              </p>
              <ButtonLink href={`/auth/login?next=/browse/${app.id}`} size="sm" className="mt-3">
                Google로 시작하기
                <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </ButtonLink>
            </Notice>
          ) : app.google_group_url ? (
            <Notice kind="caution" title={<StepTitle step="1단계 필수">Google 그룹에 먼저 가입하세요</StepTitle>}>
              <p className="m-0">
                Google Play Closed Testing은 지정된 Google 그룹 구성원만 초대 링크를 사용할
                수 있습니다. 그룹 가입 없이 초대 링크를 열면 오류가 발생합니다.
              </p>
              <ButtonLink
                href={app.google_group_url}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                className="mt-3"
              >
                Google 그룹 가입하기
                <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </ButtonLink>
            </Notice>
          ) : user ? (
            // 그룹 미설정 앱 — 공용 그룹 가입을 소프트하게 유도 (테스터 전용 유저 접점)
            <Notice kind="info" title={<StepTitle step="추천">공용 테스터 그룹에 미리 가입해두세요 (최초 1회)</StepTitle>}>
              <p className="m-0">
                Tester Match 앱 대부분이 공용 그룹 <strong className="font-mono">{PLAY_GROUP_EMAIL}</strong> 으로
                테스터를 승인합니다. 한 번 가입해두면 앞으로 어떤 앱이든 바로 참여할 수
                있습니다. Google Play 와 동일한 계정으로 가입해주세요.
              </p>
              <PlayGroupJoinPrompt compact />
            </Notice>
          ) : null}

          {/* ── 초대 링크 (그룹 가입 후 2단계 / 그룹 없으면 바로) ── */}
          {linksRevealed ? (
            <div className="flex flex-col gap-3">
              {app.google_group_url && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ink">2단계</Badge>
                  <p className="m-0 text-sm text-ink-700">
                    그룹 가입 완료 후 아래 링크로 Closed Testing에 참여하세요.
                  </p>
                </div>
              )}
              {!app.google_group_url && !isOwn && (
                <p className="m-0 text-sm text-ink-700">
                  본인 디바이스에서 아래 링크로 Closed Testing에 가입하세요.
                </p>
              )}
              {isOwn && <p className="m-0 text-sm text-ink-700">본인 앱입니다. 등록한 링크를 확인합니다.</p>}
              <dl className="m-0 border-t border-ink-900">
                <LinkRow label="안드로이드" url={app.store_invite_url} />
                <LinkRow label="웹 (브라우저)" url={app.web_invite_url} />
              </dl>
            </div>
          ) : (
            <Notice
              kind="info"
              title={
                app.google_group_url
                  ? "그룹 가입 후 참여 신청하면 초대 링크가 공개됩니다."
                  : "초대 링크는 참여 신청 후 공개됩니다."
              }
            >
              유료 시트가 열린 앱은 시트당 최대 {SEAT_REWARD_MAX} 크레딧(구매자 확정 후 지급), 그 외 품앗이 참여는
              신뢰도가 쌓입니다.
            </Notice>
          )}

          {!isOwn && user && (
            <div className="mt-2">
              <OptInButton
                appId={app.id}
                alreadyJoined={joined}
                isOwn={false}
                isFull={false}
                openSeats={openSeats}
              />
            </div>
          )}
          {!user && (
            <div className="mt-2">
              <ButtonLink href={`/auth/login?next=/browse/${app.id}`}>
                로그인하고 참여하기
                <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </ButtonLink>
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
          <section aria-labelledby="comments-heading" className="mt-12 flex flex-col gap-3 border-t border-ink-900 pt-8">
            <h2 id="comments-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
              댓글 <span className="font-mono text-ink-600 tabular-nums">{enrichedComments.length}</span>
            </h2>
            <p className="m-0 text-sm text-ink-700">댓글을 작성하려면 로그인이 필요합니다.</p>
            {enrichedComments.length > 0 && (
              <ul className="m-0 list-none border-t border-ink-200 p-0">
                {enrichedComments.slice(0, 10).map((c) => (
                  <li key={c.id} className="border-b border-ink-200 py-3">
                    <p className="m-0 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                      {c.author_nickname}
                      {c.author_role === "admin" && <AdminBadge />}
                    </p>
                    <p className="m-0 mt-1 text-sm whitespace-pre-wrap text-ink-900">{c.body}</p>
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

/** 안내 상자 제목 — 단계 표시(mono) + 제목 */
function StepTitle({ step, children }: { step: string; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-mono text-xs">{step}</span>
      <span>{children}</span>
    </span>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-ink-200 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-28 shrink-0 text-sm font-semibold text-ink-900">{label}</dt>
      <dd className="m-0 min-w-0">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] break-all text-ink-900 underline hover:text-accent-600"
          >
            {url}
          </a>
        ) : (
          <span className="text-sm text-ink-600">미등록</span>
        )}
      </dd>
    </div>
  );
}
