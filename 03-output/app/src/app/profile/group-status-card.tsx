"use client";

import { useCallback, useEffect, useState } from "react";

type Membership = {
  ok: boolean;
  joined: boolean;
  live: boolean;
  joined_at: string | null;
  group_email: string;
  group_url: string;
  play_joined: boolean;
  play_group_email: string;
  play_group_join_url: string;
};

export function GroupStatusCard() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<Membership | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/groups/membership", { cache: "no-store" });
      if (!res.ok) {
        setState("error");
        return;
      }
      setData((await res.json()) as Membership);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markPlayJoined(value: boolean) {
    setBusy(true);
    try {
      await fetch("/api/groups/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ play: value }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">테스터 그룹</h2>
        {state === "ready" && data && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              data.play_joined
                ? "bg-mint-500/10 text-mint-500"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {data.play_joined ? "가입 완료 ✓" : "가입 필요"}
          </span>
        )}
      </div>

      {state === "loading" && <p className="mt-3 text-sm text-neutral-400">확인 중…</p>}
      {state === "error" && (
        <p className="mt-3 text-sm text-crimson-500">상태 확인에 실패했습니다. 새로고침해주세요.</p>
      )}

      {state === "ready" && data && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            Google Play 비공개 테스트에 참여하려면 공개 테스터 그룹{" "}
            <strong className="font-semibold text-neutral-800">{data.play_group_email}</strong> 에
            가입되어 있어야 합니다. 가입은 1회면 충분하며, 이후 모든 앱의 테스트에 참여할 수
            있습니다.
          </p>

          {data.play_joined ? (
            <div className="mt-4 rounded-xl border border-mint-500/30 bg-mint-500/5 px-4 py-3">
              <p className="text-sm font-semibold text-mint-500">
                ✓ 그룹 가입 확인됨 — 모든 앱의 초대 링크를 바로 사용할 수 있습니다
              </p>
              <button
                type="button"
                onClick={() => markPlayJoined(false)}
                disabled={busy}
                className="mt-1.5 text-[11px] text-neutral-400 underline-offset-2 hover:underline"
              >
                가입 상태 재설정
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
                <li>
                  아래 버튼으로 그룹 페이지를 열고{" "}
                  <strong className="font-semibold">[그룹 가입]</strong> 을 눌러주세요 (1클릭)
                </li>
                <li>가입 후 돌아와서 [가입 완료] 를 눌러주세요</li>
              </ol>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={data.play_group_join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
                >
                  그룹 가입 페이지 열기 ↗
                </a>
                <button
                  type="button"
                  onClick={() => markPlayJoined(true)}
                  disabled={busy}
                  className="rounded-lg border border-mint-500/40 bg-mint-500/5 px-4 py-2 text-sm font-semibold text-mint-500 hover:bg-mint-500/10 disabled:opacity-50"
                >
                  {busy ? "저장 중..." : "가입 완료했어요 ✓"}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                ⚠️ Google Play 에서 사용하는 것과 동일한 Google 계정으로 가입해주세요.
              </p>
            </div>
          )}

          <p className="mt-4 border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-400">
            내부 커뮤니티 그룹({data.group_email})에는 로그인 시 자동 등록됩니다
            {data.joined ? " — 등록 확인됨 ✓" : ""}. 별도 작업이 필요 없습니다.
          </p>
        </>
      )}
    </section>
  );
}
