import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentDayN } from "@/lib/checkin";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { PlayGroupJoinPrompt } from "@/components/play-group-join-prompt";
import { OptOutButton } from "./opt-out-button";
import { CheckInButton } from "./check-in-button";
import { InstalledButton } from "./installed-button";

export const runtime = 'edge';

export const metadata = { title: "내 테스트" };

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  active: { text: "진행중", tone: "bg-trust-50 text-trust-700" },
  completed: { text: "완주", tone: "bg-mint-500/10 text-mint-500" },
  opted_out: { text: "옵트아웃", tone: "bg-neutral-100 text-neutral-500" },
  penalized: { text: "페널티", tone: "bg-crimson-500/10 text-crimson-500" },
};

export default async function MyTestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/my-tests");

  const supabase = createSupabaseAdminClient();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, status, matched_at, opted_in_at, installed_at, app_id, apps!inner(id, name, short_description, store_invite_url, web_invite_url, google_group_url, owner_user_id, users_public_profile!inner(nickname, trust_score)), checkins(id, day_n)",
    )
    .eq("tester_user_id", user.id)
    .order("opted_in_at", { ascending: false });

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">내 테스트</h1>
          <p className="mt-1 text-sm text-neutral-600">
            참여중인 앱과 14일 체크인을 한 화면에서 추적합니다. 보상 제도는 정식 출시 후 안내 예정입니다.
          </p>
        </header>

        <div className="mt-8">
          {matches && matches.length > 0 ? (
            <ul className="space-y-3">
              {matches.map((m) => {
                const app = Array.isArray(m.apps) ? m.apps[0] : m.apps;
                if (!app) return null;
                const owner = Array.isArray(app.users_public_profile)
                  ? app.users_public_profile[0]
                  : app.users_public_profile;
                const checkins = (m.checkins ?? []) as Array<{ id: number; day_n: number }>;
                const checkedDays = new Set(checkins.map((c) => c.day_n));
                const checkedCount = checkedDays.size;
                const todayDayN = m.opted_in_at ? currentDayN(m.opted_in_at) : 0;
                const alreadyCheckedToday = todayDayN > 0 && checkedDays.has(todayDayN);
                const expired = todayDayN === 0;
                const label = STATUS_LABEL[m.status] ?? STATUS_LABEL.active;
                const isActive = m.status === "active";

                return (
                  <li
                    key={m.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
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

                    {(isActive || m.status === "completed") && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                          <span className="tabular">
                            체크인 <strong className="text-trust-600">{checkedCount}</strong>일
                            {" / 14일"}
                          </span>
                          <span>등록자 {owner?.nickname ?? "—"}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full bg-trust-600 transition-all"
                            style={{ width: `${(checkedCount / 14) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Google 그룹 — 초대 링크보다 먼저 표시 */}
                    {app.google_group_url === TESTER_GROUP_URL && isActive ? (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          1단계
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-amber-800">
                            공용 테스터 그룹({PLAY_GROUP_EMAIL}) 가입이 필요합니다 (최초 1회).
                            이미 가입했다면 초대 링크를 바로 사용하세요.
                          </p>
                          <PlayGroupJoinPrompt compact />
                        </div>
                      </div>
                    ) : app.google_group_url && isActive ? (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          1단계
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-amber-800">
                            초대 링크 전에 Google 그룹 가입이 필요합니다.
                          </p>
                          <a
                            href={app.google_group_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs font-semibold text-amber-700 underline"
                          >
                            그룹 가입하기 →
                          </a>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isActive && (
                        <CheckInButton
                          matchId={m.id}
                          alreadyCheckedToday={alreadyCheckedToday}
                          expired={expired}
                        />
                      )}
                      {isActive &&
                        (m.installed_at ? (
                          <span className="rounded-lg bg-mint-500/10 px-2.5 py-1.5 text-xs font-semibold text-mint-500">
                            📲 설치 확인됨 ✓
                          </span>
                        ) : (
                          <InstalledButton matchId={m.id} />
                        ))}
                      {app.store_invite_url && (
                        <a
                          href={app.store_invite_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          {app.google_group_url && app.google_group_url !== TESTER_GROUP_URL
                            ? "안드로이드 (2단계) ↗"
                            : "안드로이드 ↗"}
                        </a>
                      )}
                      {app.web_invite_url && (
                        <a
                          href={app.web_invite_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          {app.google_group_url && app.google_group_url !== TESTER_GROUP_URL
                            ? "웹 (2단계) ↗"
                            : "웹 ↗"}
                        </a>
                      )}
                      <Link
                        href={`/browse/${app.id}`}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        앱 정보
                      </Link>
                      {isActive && <OptOutButton matchId={m.id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <p className="text-base font-medium text-neutral-700">
                아직 참여중인 테스트가 없습니다.
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                매칭 가능 앱에서 관심 가는 앱을 골라 참여해보세요.
              </p>
              <Link
                href="/browse"
                className="mt-6 inline-flex rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                매칭 가능 앱 보기 →
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
