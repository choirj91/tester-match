"use client";

import { useCallback, useEffect, useState } from "react";

type Membership = {
  ok: boolean;
  joined: boolean;
  live: boolean;
  joined_at: string | null;
  group_email: string;
  group_url: string;
};

export function GroupStatusCard() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<Membership | null>(null);
  const [retrying, setRetrying] = useState(false);

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

  async function retry() {
    setRetrying(true);
    try {
      await fetch("/api/groups/membership", { method: "POST" });
      await load();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">테스터 그룹</h2>
        {state === "ready" && data && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              data.joined
                ? "bg-mint-500/10 text-mint-500"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {data.joined ? "가입됨 ✓" : "미가입"}
          </span>
        )}
        {state === "ready" && data?.live && (
          <span className="text-[10px] font-semibold text-neutral-400">실시간 확인됨</span>
        )}
      </div>

      {state === "loading" && (
        <p className="mt-3 text-sm text-neutral-400">확인 중…</p>
      )}
      {state === "error" && (
        <p className="mt-3 text-sm text-crimson-500">상태 확인에 실패했습니다. 새로고침해주세요.</p>
      )}

      {state === "ready" && data && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            {data.joined ? (
              <>
                <strong className="font-semibold text-neutral-800">{data.group_email}</strong> 그룹의
                멤버입니다. Tester Match 의 모든 앱 테스트에 바로 참여할 수 있습니다.
              </>
            ) : (
              <>
                아직 공용 테스터 그룹에 가입되지 않았습니다. 그룹에 가입해야 Closed Testing
                초대 링크를 사용할 수 있습니다.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!data.joined && (
              <button
                type="button"
                onClick={retry}
                disabled={retrying}
                className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
              >
                {retrying ? "가입 시도 중..." : "지금 가입하기"}
              </button>
            )}
            <a
              href={data.group_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-trust-600 underline-offset-2 hover:underline"
            >
              그룹 페이지 열기 ↗
            </a>
          </div>
        </>
      )}
    </section>
  );
}
