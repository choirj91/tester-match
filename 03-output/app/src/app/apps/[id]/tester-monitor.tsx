import { RemindButton } from "./remind-button";

const MATCH_STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  active: { text: "진행중", tone: "bg-trust-50 text-trust-700" },
  completed: { text: "완주", tone: "bg-mint-500/10 text-mint-500" },
  opted_out: { text: "옵트아웃", tone: "bg-neutral-100 text-neutral-500" },
  penalized: { text: "페널티", tone: "bg-crimson-500/10 text-crimson-500" },
  pending: { text: "대기", tone: "bg-neutral-100 text-neutral-700" },
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
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          테스터 모니터링{" "}
          <span className="tabular text-neutral-500">{rows.length}</span>
        </h2>
        {notCheckedToday > 0 && (
          <RemindButton appId={appId} pendingCount={notCheckedToday} />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="설치 확인" value={`${installed}/${rows.length}`} />
        <MiniStat label="오늘 체크인" value={`${checkedToday}/${rows.length}`} />
        <MiniStat label="24시간 내 접속" value={`${seen24h}/${rows.length}`} />
        <MiniStat label="진행중" value={`${active.length}명`} />
      </dl>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {rows.length > 0 ? (
          <ul className="divide-y divide-neutral-100">
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
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                      {r.nickname}
                      <span className="ml-2 text-xs font-normal text-neutral-500">
                        신뢰 <span className="tabular">{r.trustScore}</span>
                      </span>
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${label.tone}`}
                    >
                      {label.text}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                    <span>
                      {r.installedAt ? (
                        <span className="font-semibold text-mint-500">📲 설치 확인 ✓</span>
                      ) : (
                        <span className="text-amber-600">📲 설치 미확인</span>
                      )}
                    </span>
                    <span>
                      접속{" "}
                      <span
                        className={
                          r.lastSeenAt &&
                          Date.now() - new Date(r.lastSeenAt).getTime() < dayMs
                            ? "font-semibold text-mint-500"
                            : "text-neutral-500"
                        }
                      >
                        {relativeTime(r.lastSeenAt)}
                      </span>
                    </span>
                    <span>
                      체크인{" "}
                      {checkedTodayRow ? (
                        <span className="font-semibold text-mint-500">오늘 완료 ✓</span>
                      ) : (
                        <span className="text-neutral-500">{relativeTime(lastCheckin)}</span>
                      )}
                    </span>
                    <span className="tabular text-neutral-500">{days.size}/14일</span>
                  </div>

                  {/* 14일 그리드 */}
                  <div className="mt-2 flex gap-1" aria-label={`체크인 ${days.size}/14일`}>
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
                      <span
                        key={d}
                        title={`Day ${d}`}
                        className={`h-2 flex-1 rounded-sm ${
                          days.has(d) ? "bg-trust-600" : "bg-neutral-100"
                        }`}
                      />
                    ))}
                  </div>
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

      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        ℹ️ Google Play 는 개별 테스터의 실제 설치·실행 여부를 개발자에게 제공하지 않습니다
        (공개/비공개 테스트 무관). 위 지표는 Tester Match 의 설치 자가확인·플랫폼 접속·일일
        체크인 기록입니다. 공식 옵트인 수는 Play Console 대시보드에서 확인하세요.
      </p>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-neutral-900 tabular">{value}</dd>
    </div>
  );
}
