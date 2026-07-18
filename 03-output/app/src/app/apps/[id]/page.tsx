import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";
import { DeleteAppButton } from "./delete-app-button";
import { BoostToggle } from "./boost-toggle";
import { KakaoOpenchatShareButton } from "@/components/kakao-openchat-share-button";
import { TESTER_GROUP_URL } from "@/lib/tester-group";
import { KpiSection } from "./kpi-section";
import {
  isGroupsAutoJoinEnabled,
  getTesterGroupEmail,
  getTesterGroupUrl,
} from "@/lib/google-groups";

export const runtime = 'edge';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
};

const MATCH_STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  active: { text: "진행중", tone: "bg-trust-50 text-trust-700" },
  completed: { text: "완주", tone: "bg-mint-500/10 text-mint-500" },
  opted_out: { text: "옵트아웃", tone: "bg-neutral-100 text-neutral-500" },
  penalized: { text: "페널티", tone: "bg-crimson-500/10 text-crimson-500" },
  pending: { text: "대기", tone: "bg-neutral-100 text-neutral-700" },
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
      "id, status, opted_in_at, day_count, tester_user_id, users_public_profile!inner(nickname, trust_score), checkins(id, day_n)",
    )
    .eq("app_id", appId)
    .order("opted_in_at", { ascending: false });

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

        {isGroupsAutoJoinEnabled() && (
          <section className="mt-8 rounded-2xl border border-mint-500/40 bg-mint-500/5 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold text-white">
                자동 그룹
              </span>
              <h2 className="text-lg font-semibold text-neutral-900">
                Tester Match 공용 Google 그룹
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-neutral-700">
              가입한 모든 Tester Match 유저는 아래 그룹에 자동으로 등록됩니다.
              이 그룹 이메일을 Play Console 클로즈드 트랙의 tester group 으로 지정하면,
              별도 이메일 등록 없이 전체 커뮤니티가 즉시 테스터로 잡힙니다.
            </p>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-neutral-500">
                <strong className="text-neutral-700">그룹 이메일:</strong>{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-mint-600">
                  {getTesterGroupEmail()}
                </code>
              </p>
              {getTesterGroupUrl() && (
                <p className="text-xs text-neutral-500">
                  <strong className="text-neutral-700">그룹 페이지:</strong>{" "}
                  <a
                    href={getTesterGroupUrl() ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-trust-600 underline hover:text-trust-700"
                  >
                    {getTesterGroupUrl()}
                  </a>
                </p>
              )}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">참여 링크</h2>
          {app.google_group_url && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-800">Google 그룹 (1단계 필수)</p>
              <p className="mt-0.5 text-xs text-amber-700">
                테스터가 초대 링크를 사용하기 전 이 그룹에 먼저 가입해야 합니다.
              </p>
              <Row label="Google 그룹" url={app.google_group_url} amber />
            </div>
          )}
          <div className="mt-4 space-y-3 text-sm">
            {app.google_group_url && (
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

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-900">
            참여중인 테스터{" "}
            <span className="tabular text-neutral-500">{matches?.length ?? 0}</span>
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {matches && matches.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {matches.map((m) => {
                  const tester = Array.isArray(m.users_public_profile)
                    ? m.users_public_profile[0]
                    : m.users_public_profile;
                  const checkins = (m.checkins ?? []) as Array<{ day_n: number }>;
                  const distinctDays = new Set(checkins.map((c) => c.day_n)).size;
                  const label = MATCH_STATUS_LABEL[m.status] ?? MATCH_STATUS_LABEL.pending;

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
                          {" · "}
                          체크인 <span className="tabular">{distinctDays}</span>/14일
                        </p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full bg-trust-600"
                            style={{ width: `${(distinctDays / 14) * 100}%` }}
                          />
                        </div>
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
  lines.push(`📱 [Tester Match] "${args.appName}" 안드로이드 비공개 테스터 모집 (${args.remaining}명)`);
  lines.push("");
  lines.push(args.shortDescription);
  lines.push("");
  lines.push("참여 방법 (5분)");

  let stepIdx = 1;
  const stepMarks = ["①", "②", "③", "④"];

  if (args.googleGroupUrl === TESTER_GROUP_URL) {
    // 공용 그룹 — 그룹 웹 페이지는 외부 비공개. Tester Match 로그인이 곧 그룹 가입.
    lines.push(`${stepMarks[stepIdx - 1]} Tester Match 에서 Google 로그인 (테스터 그룹 자동 가입)`);
    lines.push(`→ ${SITE_URL}/browse/${args.appId}`);
    stepIdx++;
  } else if (args.googleGroupUrl) {
    lines.push(`${stepMarks[stepIdx - 1]} 아래 그룹 가입 (버튼만 누르면 바로 승인)`);
    lines.push(`→ ${args.googleGroupUrl}`);
    stepIdx++;
  }
  if (args.webInviteUrl) {
    lines.push(`${stepMarks[stepIdx - 1]} 테스터 참여하기`);
    lines.push(`→ ${args.webInviteUrl}`);
    stepIdx++;
  }
  if (args.storeInviteUrl) {
    lines.push(`${stepMarks[stepIdx - 1]} 플레이스토어에서 설치`);
    lines.push(`→ ${args.storeInviteUrl}`);
    stepIdx++;
  }

  lines.push("");
  lines.push("⚠️ 꼭 지켜주세요");
  lines.push("- 설치 후 삭제하지 말고 14일 유지해주세요");
  lines.push("- 품앗이 상대 앱도 알려주시면 저도 똑같이 테스터로 참여하겠습니다 🙌");
  lines.push("");
  lines.push(`👉 상세: ${SITE_URL}/browse/${args.appId}`);

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
