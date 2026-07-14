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

  // 최근 7일 신규 매칭 (opted_in_at 기준, KST)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const buckets: { label: string; sub: string; count: number; isToday: boolean }[] = Array.from(
    { length: 7 },
    (_, i) => {
      const d = new Date(kstNow);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const mm = d.getUTCMonth() + 1;
      const dd = d.getUTCDate();
      const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
      return {
        label: `${mm}/${dd}`,
        sub: dow,
        count: 0,
        isToday: i === 6,
      };
    },
  );

  for (const m of matches) {
    if (!m.opted_in_at) continue;
    const t = new Date(m.opted_in_at).getTime() + 9 * 60 * 60 * 1000; // KST
    const daysAgo = Math.floor((kstNow.getTime() - t) / (24 * 60 * 60 * 1000));
    const idx = 6 - daysAgo;
    if (idx >= 0 && idx < 7) buckets[idx].count++;
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const recent7 = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-neutral-900">참여 지표</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        총 매칭 · 완주율 · 이탈률 · 평균 체크인 진행률
      </p>

      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <KpiCard label="총 매칭" value={total} sub={`최근 7일 +${recent7}`} tone="neutral" />
        <KpiCard label="완주율" value={`${completionRate}%`} sub={`${completed}/${total}`} tone="mint" />
        <KpiCard label="이탈률" value={`${dropRate}%`} sub={`${dropped}건`} tone="crimson" />
        <KpiCard
          label="활성 진행률"
          value={`${avgProgress}%`}
          sub={`${active}명 활성`}
          tone="trust"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-neutral-700">일별 신규 매칭 (최근 7일)</p>
        <div className="flex items-end gap-1.5" style={{ height: "72px" }}>
          {buckets.map((b, i) => {
            const barH = Math.max(
              Math.round((b.count / maxCount) * 60),
              b.count > 0 ? 6 : 2,
            );
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold text-neutral-500">{b.count}</span>
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    b.isToday ? "bg-trust-500" : "bg-trust-200"
                  }`}
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
                className={`text-[10px] ${
                  b.isToday ? "font-bold text-trust-600" : "text-neutral-400"
                }`}
              >
                {b.label}
              </span>
              <span
                className={`text-[9px] ${
                  b.isToday ? "font-semibold text-trust-400" : "text-neutral-300"
                }`}
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

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone: "mint" | "crimson" | "trust" | "neutral";
}) {
  const toneClass = {
    mint: "text-mint-500",
    crimson: "text-crimson-500",
    trust: "text-trust-600",
    neutral: "text-neutral-900",
  }[tone];
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}
