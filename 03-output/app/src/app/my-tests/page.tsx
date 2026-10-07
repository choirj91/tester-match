import { ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/state";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentDayN } from "@/lib/checkin";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { PlayGroupJoinPrompt } from "@/components/play-group-join-prompt";
import { OptOutButton } from "./opt-out-button";
import { InstallBlockedButton } from "./install-blocked-button";
import {
  SEAT_REWARD_SUMMARY,
  SEAT_STREAK_DAYS,
  SEAT_TOTAL_DAYS,
  computeSeatReward,
} from "@/lib/seat-reward-rules";
import { CheckInButton } from "./check-in-button";
import { CheckinCalendar } from "./checkin-calendar";
import { InstalledButton } from "./installed-button";

export const metadata = { title: "내 테스트" };

const STATUS_LABEL: Record<string, { text: string; tone: BadgeTone }> = {
  active: { text: "진행중", tone: "ink" },
  completed: { text: "완주", tone: "success" },
  opted_out: { text: "옵트아웃", tone: "outline" },
  penalized: { text: "페널티", tone: "danger" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <ButtonLink href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
      {children}
      <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    </ButtonLink>
  );
}

export default async function MyTestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/my-tests");

  const supabase = createSupabaseAdminClient();
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, status, matched_at, opted_in_at, installed_at, app_id, paid_order_id, apps!inner(id, name, short_description, store_invite_url, web_invite_url, google_group_url, owner_user_id, users_public_profile!inner(nickname, trust_score)), checkins(id, day_n)",
    )
    .eq("tester_user_id", user.id)
    .order("opted_in_at", { ascending: false });

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[880px] px-5 pt-10 pb-14">
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">내 테스트</h1>
          <p className="m-0 text-[15px] text-ink-700">
            참여중인 앱과 {SEAT_TOTAL_DAYS}일 체크인을 한 화면에서 추적합니다. 유료 시트는 매일 스크린샷 체크인 — {SEAT_REWARD_SUMMARY}. 12일 이상 출석 + 개발자 확정 후 지급.
          </p>
        </header>

        <div className="mt-8">
          {matches && matches.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {matches.map((m) => {
                const app = Array.isArray(m.apps) ? m.apps[0] : m.apps;
                if (!app) return null;
                const owner = Array.isArray(app.users_public_profile)
                  ? app.users_public_profile[0]
                  : app.users_public_profile;
                const checkins = (m.checkins ?? []) as Array<{ id: number; day_n: number }>;
                const checkedDays = new Set(checkins.map((c) => c.day_n));
                const checkedCount = checkedDays.size;
                const seatProgress = computeSeatReward([...checkedDays]);
                const todayDayN = m.opted_in_at ? currentDayN(m.opted_in_at) : 0;
                const alreadyCheckedToday = todayDayN > 0 && checkedDays.has(todayDayN);
                const expired = todayDayN === 0;
                // 달력용 — 오늘 이전에 지나간 날 수 (기간이 끝났으면 전부)
                const elapsedDays = todayDayN > 0 ? todayDayN - 1 : m.opted_in_at ? SEAT_TOTAL_DAYS : 0;
                const label = STATUS_LABEL[m.status] ?? STATUS_LABEL.active;
                const isActive = m.status === "active";
                const isPaidSeat = m.paid_order_id != null;
                const hasCustomGroup = !!app.google_group_url && app.google_group_url !== TESTER_GROUP_URL;

                return (
                  <li key={m.id} className="flex flex-col gap-4 border border-ink-900 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="m-0 truncate font-display text-h3 font-semibold text-ink-900">
                          {app.name}
                        </h2>
                        <p className="m-0 mt-1 line-clamp-2 text-sm text-ink-700">
                          {app.short_description}
                        </p>
                      </div>
                      <Badge tone={label.tone} className="shrink-0">
                        {label.text}
                      </Badge>
                    </div>

                    {/* 오늘 체크인 — 카드 첫 줄 행동 */}
                    {isActive && (
                      <CheckInButton
                        paidSeat={isPaidSeat}
                        deadlineIso={
                          todayDayN > 0 && m.opted_in_at
                            ? new Date(new Date(m.opted_in_at).getTime() + todayDayN * DAY_MS).toISOString()
                            : null
                        }
                        matchId={m.id}
                        alreadyCheckedToday={alreadyCheckedToday}
                        expired={expired}
                      />
                    )}

                    {(isActive || m.status === "completed") && (
                      <div className="flex flex-col gap-2.5 border-t border-ink-200 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-600">
                          <span className="font-mono tabular-nums">
                            체크인 <strong className="text-ink-900">{checkedCount}</strong>일
                            {` / ${SEAT_TOTAL_DAYS}일`}
                          </span>
                          <span>
                            {isPaidSeat && (
                              <strong className="text-warning-700">
                                유료 시트 · 지금까지 <span className="font-mono tabular-nums">{seatProgress.total}</span> 크레딧 (7일 연속{" "}
                                <span className="font-mono tabular-nums">
                                  {Math.min(seatProgress.longestStreak, SEAT_STREAK_DAYS)}/{SEAT_STREAK_DAYS}
                                </span>{" "}
                                · 12일↑ 완주 시 확정 후 지급) ·{" "}
                              </strong>
                            )}
                            등록자 {owner?.nickname ?? "—"}
                          </span>
                        </div>
                        <CheckinCalendar
                          checkedDays={checkedDays}
                          todayDayN={todayDayN}
                          elapsedDays={elapsedDays}
                        />
                      </div>
                    )}

                    {/* Google 그룹 — 초대 링크보다 먼저 표시 */}
                    {app.google_group_url === TESTER_GROUP_URL && isActive ? (
                      <Notice kind="caution" title={<span className="font-mono">1단계</span>}>
                        <p className="m-0">
                          공용 테스터 그룹(<span className="font-mono">{PLAY_GROUP_EMAIL}</span>) 가입이 필요합니다 (최초 1회).
                          이미 가입했다면 초대 링크를 바로 사용하세요.
                        </p>
                        <PlayGroupJoinPrompt compact />
                      </Notice>
                    ) : app.google_group_url && isActive ? (
                      <Notice kind="caution" title={<span className="font-mono">1단계</span>}>
                        <p className="m-0">초대 링크 전에 Google 그룹 가입이 필요합니다.</p>
                        <a
                          href={app.google_group_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink-900 underline hover:text-accent-600"
                        >
                          그룹 가입하기
                          <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                        </a>
                      </Notice>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      {isActive && isPaidSeat && checkedCount === 0 && (
                        <InstallBlockedButton matchId={m.id} />
                      )}
                      {isActive &&
                        (m.installed_at ? (
                          <Badge tone="success" className="min-h-11">
                            설치 확인됨
                          </Badge>
                        ) : (
                          <InstalledButton matchId={m.id} />
                        ))}
                      {app.store_invite_url && (
                        <ExternalButton href={app.store_invite_url}>
                          {hasCustomGroup ? "안드로이드 (2단계)" : "안드로이드"}
                        </ExternalButton>
                      )}
                      {app.web_invite_url && (
                        <ExternalButton href={app.web_invite_url}>
                          {hasCustomGroup ? "웹 (2단계)" : "웹"}
                        </ExternalButton>
                      )}
                      <ButtonLink href={`/browse/${app.id}`} variant="secondary" size="sm">
                        앱 정보
                      </ButtonLink>
                      {isActive && <OptOutButton matchId={m.id} paidSeat={isPaidSeat} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="아직 참여중인 테스트가 없습니다."
              description="매칭 가능 앱에서 관심 가는 앱을 골라 참여해보세요."
              action={
                <ButtonLink href="/browse">
                  매칭 가능 앱 보기
                  <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </ButtonLink>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
