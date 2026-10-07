import { StatTile, StatTiles } from "@/components/ui/stat-tile";

type Match = {
  status: string;
  opted_in_at: string | null;
  day_count?: number | null;
};

export function KpiSection({ matches }: { matches: Match[] }) {
  const total = matches.length;
  const completed = matches.filter((m) => m.status === "completed").length;
  const active = matches.filter((m) => m.status === "active").length;
  const opted_out = matches.filter((m) => m.status === "opted_out").length;
  const penalized = matches.filter((m) => m.status === "penalized").length;
  const dropped = opted_out + penalized;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const dropRate = total > 0 ? Math.round((dropped / total) * 100) : 0;

  // 활성 매칭 평균 체크인 진행률
  const activeMatches = matches.filter((m) => m.status === "active");
  const avgProgress =
    activeMatches.length === 0
      ? 0
      : Math.round(
          (activeMatches.reduce((s, m) => s + Math.min(m.day_count ?? 0, 14), 0) /
            (activeMatches.length * 14)) *
            100,
        );

  // 최근 7일 신규 매칭 (opted_in_at 기준, KST 달력 날짜로 버킷)
  // timestamp 차이가 아니라 KST 기준 YYYY-MM-DD 문자열 비교 — 자정 경계 정확.
  const kstDateStr = (utcMs: number) =>
    new Date(utcMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const todayKst = kstDateStr(Date.now());
  const buckets: {
    date: string;
    label: string;
    sub: string;
    count: number;
    isToday: boolean;
  }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
    d.setUTCDate(d.getUTCDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const mm = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return {
      date: dateStr,
      label: `${mm}/${dd}`,
      sub: dow,
      count: 0,
      isToday: dateStr === todayKst,
    };
  });

  const bucketByDate = new Map(buckets.map((b) => [b.date, b]));
  for (const m of matches) {
    if (!m.opted_in_at) continue;
    const dateStr = kstDateStr(new Date(m.opted_in_at).getTime());
    const bucket = bucketByDate.get(dateStr);
    if (bucket) bucket.count++;
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const recent7 = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <section className="mt-12 border-t border-ink-900 pt-8">
      <h2 className="m-0 font-display text-h2 font-semibold text-ink-900">참여 지표</h2>
      <p className="mt-1 text-[13px] text-ink-600">
        총 매칭 · 완주율 · 이탈률 · 평균 체크인 진행률
      </p>

      <StatTiles className="mt-5">
        <KpiTile label="총 매칭" value={total} sub={`최근 7일 +${recent7}`} tone="neutral" />
        <KpiTile label="완주율" value={`${completionRate}%`} sub={`${completed}/${total}`} tone="success" />
        <KpiTile label="이탈률" value={`${dropRate}%`} sub={`${dropped}건`} tone="danger" />
        <KpiTile label="활성 진행률" value={`${avgProgress}%`} sub={`${active}명 활성`} tone="neutral" />
      </StatTiles>

      <div className="mt-6 border border-ink-900 bg-white p-5">
        <p className="mb-4 text-sm font-bold text-ink-900">일별 신규 매칭 (최근 7일)</p>
        <div className="flex items-end gap-1.5" style={{ height: "72px" }}>
          {buckets.map((b, i) => {
            const barH = Math.max(
              Math.round((b.count / maxCount) * 60),
              b.count > 0 ? 6 : 2,
            );
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-[11px] text-ink-700 tabular-nums">{b.count}</span>
                <div
                  className={`w-full border border-ink-900 ${b.isToday ? "bg-ink-900" : "bg-white"}`}
                  style={{ height: `${barH}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {buckets.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center">
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  b.isToday ? "font-bold text-ink-900" : "text-ink-600"
                }`}
              >
                {b.label}
              </span>
              <span
                className={`text-[11px] ${b.isToday ? "font-bold text-ink-900" : "text-ink-600"}`}
              >
                {b.sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone: "success" | "danger" | "neutral";
}) {
  const toneClass = {
    success: "text-success-700",
    danger: "text-danger-700",
    neutral: "text-ink-900",
  }[tone];
  return (
    <StatTile
      rule
      label={label}
      value={
        <>
          <span className={`font-mono ${toneClass}`}>{value}</span>
          <span className="mt-0.5 block font-mono text-xs font-normal text-ink-600">{sub}</span>
        </>
      }
    />
  );
}
