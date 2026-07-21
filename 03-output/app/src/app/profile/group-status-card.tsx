"use client";

import { useCallback, useEffect, useState } from "react";

type Membership = {
  ok: boolean;
  joined: boolean;
  live: boolean;
  joined_at: string | null;
  group_email: string;
  group_url: string;
  play_group_email: string;
  play_group_join_url: string;
};

export function GroupStatusCard() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<Membership | null>(null);

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

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">테스터 그룹</h2>

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
            있습니다. 이미 가입했다면 다시 누를 필요 없습니다.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={data.play_group_join_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
            >
              그룹 가입하기 (1클릭) ↗
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            ⚠️ Google Play 에서 사용하는 것과 동일한 Google 계정으로 가입해주세요. 그룹에
            가입되어 있지 않으면 앱 초대 링크가 열리지 않습니다.
          </p>

          <p className="mt-4 border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-400">
            내부 커뮤니티 그룹({data.group_email})에는 로그인 시 자동 등록됩니다
            {data.joined ? " — 등록 확인됨 ✓" : ""}. 별도 작업이 필요 없습니다.
          </p>
        </>
      )}
    </section>
  );
}
