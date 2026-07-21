import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";
import { DeleteAppButton } from "./delete-app-button";
import { BoostToggle } from "./boost-toggle";
import { KakaoOpenchatShareButton } from "@/components/kakao-openchat-share-button";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL, PLAY_GROUP_JOIN_URL } from "@/lib/tester-group";
import { CopyGroupEmailButton } from "@/components/copy-group-email-button";
import { KpiSection } from "./kpi-section";
import { isGroupsAutoJoinEnabled } from "@/lib/google-groups";
import { UpgradeGroupBanner } from "./upgrade-group-banner";
import { TesterMonitor } from "./tester-monitor";

export const runtime = 'edge';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
};

export default async function AppDetailPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/apps/${id}`);
  }

  const { id } = await params;
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select(
      "id, owner_user_id, name, short_description, store_invite_url, web_invite_url, google_group_url, required_testers, status, is_boost, boost_deadline_at, created_at, updated_at",
    )
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!app) notFound();

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, status, opted_in_at, day_count, installed_at, tester_user_id, users_public_profile!inner(nickname, trust_score), checkins(id, day_n, checked_in_at)",
    )
    .eq("app_id", appId)
    .order("opted_in_at", { ascending: false });

  // 테스터별 플랫폼 마지막 접속 (users_public_profile 뷰에 없음 → 별도 조회)
  const testerIds = [...new Set((matches ?? []).map((m) => m.tester_user_id))];
  const lastSeenMap = new Map<number, string | null>();
  if (testerIds.length > 0) {
    const { data: seen } = await supabase
      .from("users")
      .select("id, last_seen_at")
      .in("id", testerIds);
    for (const s of seen ?? []) lastSeenMap.set(s.id, s.last_seen_at);
  }

  const monitorRows = (matches ?? []).map((m) => {
    const tester = Array.isArray(m.users_public_profile)
      ? m.users_public_profile[0]
      : m.users_public_profile;
    return {
      matchId: m.id,
      nickname: tester?.nickname ?? "—",
      trustScore: tester?.trust_score ?? 50,
      status: m.status,
      installedAt: m.installed_at ?? null,
      lastSeenAt: lastSeenMap.get(m.tester_user_id) ?? null,
      checkins: ((m.checkins ?? []) as Array<{ day_n: number; checked_in_at: string }>).map(
        (c) => ({ day_n: c.day_n, checked_in_at: c.checked_in_at }),
      ),
    };
  });

  const activeCount = matches?.filter((m) => m.status === "active").length ?? 0;
  const completedCount = matches?.filter((m) => m.status === "completed").length ?? 0;
  const statusLabel = APP_STATUS_LABEL[(app.status as AppStatus) ?? "draft"];

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
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusLabel.tone}`}
              >
                {statusLabel.text}
              </span>
              {app.is_boost && (
                <span className="inline-flex rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  BOOST
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/apps/${app.id}/request-testers`}
              className="rounded-lg border border-trust-300 bg-trust-50 px-3 py-2 text-sm font-semibold text-trust-700 hover:bg-trust-100"
            >
              테스터 요청
            </Link>
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

        <section
          className={`mt-6 rounded-2xl border p-5 ${
            isWelcome ? "border-trust-500/40 bg-trust-50" : "border-neutral-200 bg-neutral-50"
          }`}
        >
          {isWelcome && (
            <p className="mb-2 text-sm font-bold text-trust-700">
              🎉 앱 등록 완료! 지금 카톡 오픈채팅에 공유해 테스터를 모아보세요.
            </p>
          )}
          <h2 className="text-sm font-semibold text-neutral-900">테스터 모집 공유</h2>
          <p className="mt-1 text-xs text-neutral-500">
            버튼 클릭 시 문구가 클립보드에 복사되고 카톡 오픈채팅방이 새 창으로 열립니다. 채팅방에서 붙여넣기(Ctrl/⌘+V) 하면 끝.
          </p>
          <div className="mt-3">
            <KakaoOpenchatShareButton
              text={buildShareText({
                appName: app.name,
                shortDescription: app.short_description,
                remaining: app.required_testers,
                appId: app.id,
                googleGroupUrl: app.google_group_url,
                webInviteUrl: app.web_invite_url,
                storeInviteUrl: app.store_invite_url,
              })}
            />
          </div>
        </section>

        <dl className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="참여중" value={`${activeCount}명`} />
          <Stat label="완주" value={`${completedCount}명`} />
          <Stat label="목표 인원" value={`${app.required_testers}명`} />
        </dl>

        {isGroupsAutoJoinEnabled() && app.google_group_url !== TESTER_GROUP_URL && (
          <UpgradeGroupBanner id={app.id} />
        )}

        {app.google_group_url === TESTER_GROUP_URL && (
          <section className="mt-8 rounded-2xl border border-mint-500/40 bg-mint-500/5 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold text-white">
                공용 그룹
              </span>
              <h2 className="text-lg font-semibold text-neutral-900">
                Tester Match 공용 테스터 그룹
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-neutral-700">
              아래 그룹 이메일을 Play Console 비공개 테스트 트랙의 테스터 목록(Google
              그룹스)에 등록하세요. Tester Match 테스터들은 이 공용 그룹에 가입되어
              있어서, 별도 이메일 등록 없이 초대 링크를 사용할 수 있습니다.
            </p>
            <div className="mt-3">
              <p className="text-xs text-neutral-500">
                <strong className="text-neutral-700">Play Console 등록용 그룹 이메일:</strong>{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-mint-600">
                  {PLAY_GROUP_EMAIL}
                </code>
              </p>
              <CopyGroupEmailButton />
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                Play Console → 테스트 → 비공개 테스트 → 테스터 탭 → &ldquo;Google
                그룹스&rdquo;에 위 이메일을 붙여넣으면 됩니다.
              </p>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">참여 링크</h2>
          {app.google_group_url === TESTER_GROUP_URL ? (
            <div className="mt-4 rounded-xl border border-mint-500/30 bg-mint-500/5 p-4">
              <p className="text-xs font-semibold text-neutral-800">공용 테스터 그룹 사용 중</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                Play Console 비공개 테스트 트랙의 테스터 목록(Google 그룹스)에{" "}
                <code className="rounded bg-white px-1 py-0.5 text-[11px] font-semibold text-trust-700">
                  {PLAY_GROUP_EMAIL}
                </code>{" "}
                이 등록되어 있어야 합니다. 테스터에게는 그룹 1클릭 가입 안내가 자동으로
                표시됩니다.
              </p>
            </div>
          ) : app.google_group_url ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-800">Google 그룹 (1단계 필수)</p>
              <p className="mt-0.5 text-xs text-amber-700">
                테스터가 초대 링크를 사용하기 전 이 그룹에 먼저 가입해야 합니다.
              </p>
              <Row label="Google 그룹" url={app.google_group_url} amber />
            </div>
          ) : null}
          <div className="mt-4 space-y-3 text-sm">
            {app.google_group_url && app.google_group_url !== TESTER_GROUP_URL && (
              <p className="text-xs font-semibold text-neutral-500">초대 링크 (2단계)</p>
            )}
            <Row label="안드로이드" url={app.store_invite_url} />
            <Row label="웹 참여" url={app.web_invite_url} />
          </div>
        </section>

        <BoostToggle
          id={app.id}
          isBoost={app.is_boost ?? false}
          deadlineAt={app.boost_deadline_at ?? null}
        />

        <KpiSection matches={matches ?? []} />

        <TesterMonitor appId={app.id} rows={monitorRows} />
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

const SITE_URL = "https://tester-match.pages.dev";

function buildShareText(args: {
  appName: string;
  shortDescription: string;
  remaining: number;
  appId: number;
  googleGroupUrl: string | null;
  webInviteUrl: string | null;
  storeInviteUrl: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`📱 ${args.appName} 안드로이드 비공개 테스터 모집 (${args.remaining}명)`);
  lines.push("");
  lines.push(args.shortDescription);
  lines.push("");
  lines.push("참여 방법 (5분)");

  let stepIdx = 1;
  const stepMarks = ["①", "②", "③", "④"];

  if (args.googleGroupUrl === TESTER_GROUP_URL) {
    // 공용 그룹 — Play 자격은 consumer 그룹 1클릭 가입으로 부여.
    lines.push(`${stepMarks[stepIdx - 1]} 공용 테스터 그룹에 가입해 주세요 (버튼 1클릭, 최초 1회면 끝)`);
    lines.push(`→ ${PLAY_GROUP_JOIN_URL}`);
    lines.push("✨ 한 번 가입하면 Tester Match 의 모든 앱 테스트에 참여할 수 있어요!");
    stepIdx++;
  } else if (args.googleGroupUrl) {
    lines.push(`${stepMarks[stepIdx - 1]} Google 그룹에 가입해 주세요 (버튼만 누르면 바로 승인)`);
    lines.push(`→ ${args.googleGroupUrl}`);
    stepIdx++;
  }
  if (args.webInviteUrl) {
    lines.push(`${stepMarks[stepIdx - 1]} 비공개 테스트에 참여해 주세요 ('테스터 되기' 클릭)`);
    lines.push(`→ ${args.webInviteUrl}`);
    stepIdx++;
  }
  if (args.storeInviteUrl) {
    lines.push(`${stepMarks[stepIdx - 1]} Play 스토어에서 앱을 설치해 주세요`);
    lines.push(`→ ${args.storeInviteUrl}`);
    stepIdx++;
  }

  lines.push("");
  lines.push("⚠️ 꼭 확인해 주세요");
  lines.push("- Google Play에서 사용하는 동일한 Google 계정으로 참여해 주세요");
  lines.push("- 설치 후 삭제하지 말고 14일 이상 유지해 주세요");
  lines.push("- 테스트 기간에는 가능하면 매일 앱을 한 번씩 실행해 주세요");
  lines.push("- 오류나 개선 의견을 남겨주시면 큰 힘이 됩니다");
  lines.push("");
  lines.push("🤝 품앗이 환영");
  lines.push("품앗이할 앱과 참여 링크를 알려주시면 저도 똑같이 테스터로 참여하겠습니다.");
  lines.push("도움 주셔서 감사합니다 🙏");
  lines.push("");
  lines.push(`👉 앱 상세·참여 현황: ${SITE_URL}/browse/${args.appId}`);

  return lines.join("\n");
}

function Row({ label, url, amber }: { label: string; url: string | null; amber?: boolean }) {
  if (!url) {
    return (
      <p className="text-neutral-400">
        <strong className="font-semibold">{label}:</strong> 미등록
      </p>
    );
  }
  return (
    <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <strong className={`shrink-0 font-semibold ${amber ? "text-amber-800" : "text-neutral-700"}`}>{label}</strong>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`break-all underline text-sm ${amber ? "text-amber-700 hover:text-amber-900" : "text-trust-600 hover:text-trust-700"}`}
      >
        {url}
      </a>
    </p>
  );
}
