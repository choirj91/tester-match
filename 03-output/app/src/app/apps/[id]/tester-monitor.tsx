import { Check, Info } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/state";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { RemindButton } from "./remind-button";

const MATCH_STATUS_LABEL: Record<string, { text: string; tone: BadgeTone }> = {
  active: { text: "진행중", tone: "ink" },
  completed: { text: "완주", tone: "success" },
  opted_out: { text: "옵트아웃", tone: "outline" },
  penalized: { text: "페널티", tone: "danger" },
  pending: { text: "대기", tone: "outline" },
};

export type MonitorRow = {
  matchId: number;
  nickname: string;
  trustScore: number;
  status: string;
  installedAt: string | null;
  lastSeenAt: string | null;
  checkins: Array<{ day_n: number; checked_in_at: string }>;
};

/** KST 기준 오늘 00:00 epoch(ms) */
function kstTodayStartMs(): number {
  const kstDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return new Date(`${kstDate}T00:00:00+09:00`).getTime();
}

function relativeTime(iso: string | null): string {
  if (!iso) return "기록 없음";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return "방금 전";
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

/**
 * 개발자용 테스터 모니터링.
 * Google 은 개별 설치·실행을 제공하지 않으므로 플랫폼 신호 3종으로 대체:
 * 설치 자가확인 / 플랫폼 접속(last_seen) / 14일 체크인.
 */
export function TesterMonitor({ appId, rows }: { appId: number; rows: MonitorRow[] }) {
  const todayStart = kstTodayStartMs();
  const dayMs = 24 * 60 * 60 * 1000;

  const active = rows.filter((r) => r.status === "active" || r.status === "pending");
  const installed = rows.filter((r) => r.installedAt).length;
  const checkedToday = rows.filter((r) =>
    r.checkins.some((c) => new Date(c.checked_in_at).getTime() >= todayStart),
  ).length;
  const seen24h = rows.filter(
    (r) => r.lastSeenAt && Date.now() - new Date(r.lastSeenAt).getTime() < dayMs,
  ).length;
  const notCheckedToday = active.filter(
    (r) => !r.checkins.some((c) => new Date(c.checked_in_at).getTime() >= todayStart),
  ).length;

  return (
    <section className="mt-12 border-t border-ink-900 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-display text-h2 font-semibold text-ink-900">
          테스터 모니터링{" "}
          <span className="font-mono text-[22px] text-ink-600 tabular-nums">{rows.length}</span>
        </h2>
        {notCheckedToday > 0 && (
          <RemindButton appId={appId} pendingCount={notCheckedToday} />
        )}
      </div>

      <StatTiles className="mt-5">
        <MiniStat label="설치 확인" value={`${installed}/${rows.length}`} />
        <MiniStat label="오늘 체크인" value={`${checkedToday}/${rows.length}`} />
        <MiniStat label="24시간 내 접속" value={`${seen24h}/${rows.length}`} />
        <MiniStat label="진행중" value={`${active.length}명`} />
      </StatTiles>

      <div className="mt-6">
        {rows.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-ink-200 border border-ink-900 bg-white p-0">
            {rows.map((r) => {
              const label = MATCH_STATUS_LABEL[r.status] ?? MATCH_STATUS_LABEL.pending;
              const days = new Set(r.checkins.map((c) => c.day_n));
              const lastCheckin =
                r.checkins.length > 0
                  ? r.checkins.reduce((a, b) =>
                      a.checked_in_at > b.checked_in_at ? a : b,
                    ).checked_in_at
                  : null;
              const checkedTodayRow = r.checkins.some(
                (c) => new Date(c.checked_in_at).getTime() >= todayStart,
              );

              return (
                <li key={r.matchId} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink-900">
                      {r.nickname}
                      <span className="ml-2 text-[13px] font-normal text-ink-600">
                        신뢰도 <span className="tabular">{r.trustScore}</span>
                      </span>
                    </p>
                    <Badge tone={label.tone} className="shrink-0">
                      {label.text}
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-700">
                    <span>
                      {r.installedAt ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-success-700">
                          설치 확인
                          <Check className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="text-warning-700">설치 미확인</span>
                      )}
                    </span>
                    <span>
                      접속{" "}
                      <span
                        className={
                          r.lastSeenAt &&
                          Date.now() - new Date(r.lastSeenAt).getTime() < dayMs
                            ? "font-semibold text-success-700"
                            : "text-ink-600"
                        }
                      >
                        {relativeTime(r.lastSeenAt)}
                      </span>
                    </span>
                    <span>
                      체크인{" "}
                      {checkedTodayRow ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-success-700">
                          오늘 완료
                          <Check className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="text-ink-600">{relativeTime(lastCheckin)}</span>
                      )}
                    </span>
                    <span className="tabular text-ink-700">{days.size}/14일</span>
                  </div>

                  {/* 14일 그리드 */}
                  <div className="mt-2.5 flex gap-1" role="img" aria-label={`체크인 ${days.size}/14일`}>
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
                      <span
                        key={d}
                        title={`Day ${d}`}
                        className={`h-2.5 flex-1 border border-ink-900 ${
                          days.has(d) ? "bg-ink-900" : "bg-white"
                        }`}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="아직 참여한 테스터가 없습니다." />
        )}
      </div>

      <p className="mt-3 flex gap-2 text-[13px] leading-relaxed text-ink-600">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-900" strokeWidth={1.8} aria-hidden="true" />
        <span>
          Google Play 는 개별 테스터의 실제 설치·실행 여부를 개발자에게 제공하지 않습니다
          (공개/비공개 테스트 무관). 위 지표는 Tester Match 의 설치 자가확인·플랫폼 접속·일일
          체크인 기록입니다. 공식 옵트인 수는 Play Console 대시보드에서 확인하세요.
        </span>
      </p>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <StatTile rule label={label} value={<span className="font-mono">{value}</span>} />;
}
