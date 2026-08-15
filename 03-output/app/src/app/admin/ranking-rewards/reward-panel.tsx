"use client";

import { useCallback, useEffect, useState } from "react";

type Winner = {
  userId: number;
  nickname: string;
  trustScore: number;
  completed: number;
  rank: number;
  amount: number;
};

type Preview = {
  ok: boolean;
  month: string;
  grantable: boolean;
  startMonth: string;
  alreadyGranted: boolean;
  granted: Array<{ user_id: number; rank: number; amount: number; completed: number }>;
  candidates: Array<{ userId: number; nickname: string; trustScore: number; completed: number }>;
  winners: Winner[];
};

export function RewardPanel() {
  const [data, setData] = useState<Preview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ranking-rewards", { cache: "no-store" });
      if (!res.ok) {
        setState("error");
        return;
      }
      setData((await res.json()) as Preview);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function grant() {
    if (!data) return;
    if (!window.confirm(`${data.month.slice(0, 7)}월분 보상을 지급할까요? (되돌릴 수 없음)`)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ranking-rewards", { method: "POST" });
      const j = (await res.json()) as { ok: boolean; granted?: number; message?: string };
      setResult(j.ok ? `✓ ${j.granted}명 지급 완료` : (j.message ?? "지급 실패"));
      await load();
    } catch {
      setResult("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="mt-8 text-sm text-neutral-400">불러오는 중…</p>;
  if (state === "error" || !data)
    return <p className="mt-8 text-sm text-crimson-500">불러오기 실패. 새로고침해주세요.</p>;

  const monthLabel = data.month.slice(0, 7);

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {monthLabel}월분 (지난달) 지급
          </h2>
          {data.alreadyGranted ? (
            <span className="rounded-full bg-mint-500/10 px-3 py-1 text-xs font-bold text-mint-500">
              지급 완료 ✓
            </span>
          ) : data.grantable ? (
            <button
              type="button"
              onClick={grant}
              disabled={busy || data.winners.length === 0}
              className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
            >
              {busy ? "지급 중..." : `🏆 ${data.winners.length}명 지급`}
            </button>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              첫 지급은 {data.startMonth.slice(0, 7)}월분부터
            </span>
          )}
        </div>
        {result && <p className="mt-2 text-sm text-neutral-600">{result}</p>}

        {data.alreadyGranted ? (
          <ul className="mt-4 space-y-1 text-sm text-neutral-700">
            {data.granted.map((g) => (
              <li key={g.user_id} className="tabular">
                {g.rank}위 — user #{g.user_id} · 완주 {g.completed} · +{g.amount.toLocaleString()}
              </li>
            ))}
          </ul>
        ) : data.winners.length > 0 ? (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2">순위</th>
                <th>닉네임</th>
                <th className="text-right">완주</th>
                <th className="text-right">신뢰도</th>
                <th className="text-right">보상</th>
              </tr>
            </thead>
            <tbody>
              {data.winners.map((w) => (
                <tr key={w.userId} className="border-b border-neutral-50">
                  <td className="py-2 font-bold">{w.rank}위</td>
                  <td>{w.nickname}</td>
                  <td className="tabular text-right">{w.completed}</td>
                  <td className="tabular text-right">{w.trustScore}</td>
                  <td className="tabular text-right font-semibold text-trust-600">
                    +{w.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">지급 대상 없음 (자격 충족 완주자 없음).</p>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">후보 전체 (자격 필터 적용 후)</h2>
        {data.candidates.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-neutral-700">
            {data.candidates.map((c, i) => (
              <li key={c.userId} className="tabular">
                {i + 1}. {c.nickname} — 완주 {c.completed} · 신뢰도 {c.trustScore}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">해당 월 완주자 없음.</p>
        )}
      </div>
    </section>
  );
}
