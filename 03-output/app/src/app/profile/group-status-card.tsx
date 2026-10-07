"use client";

import { Check, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ErrorState, LoadingState } from "@/components/ui/state";

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
    <section aria-labelledby="group-title" className="flex flex-col gap-4 border-t border-ink-900 pt-6">
      <h2 id="group-title" className="m-0 font-display text-h3 font-semibold text-ink-900">
        테스터 그룹
      </h2>

      {state === "loading" && <LoadingState title="확인 중…" />}
      {state === "error" && <ErrorState title="상태 확인에 실패했습니다." description="새로고침해주세요." />}

      {state === "ready" && data && (
        <>
          <p className="m-0 text-[15px] leading-relaxed text-ink-700">
            Google Play 비공개 테스트에 참여하려면 공개 테스터 그룹{" "}
            <strong className="font-semibold break-all text-ink-900">{data.play_group_email}</strong> 에
            가입되어 있어야 합니다. 가입은 1회면 충분하며, 이후 모든 앱의 테스트에 참여할 수
            있습니다. 이미 가입했다면 다시 누를 필요 없습니다.
          </p>

          <ButtonLink
            href={data.play_group_join_url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start"
          >
            그룹 가입하기 (1클릭)
            <ExternalLink className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </ButtonLink>

          <Notice kind="caution">
            Google Play 에서 사용하는 것과 동일한 Google 계정으로 가입해주세요. 그룹에 가입되어 있지
            않으면 앱 초대 링크가 열리지 않습니다.
          </Notice>

          <p className="m-0 border-t border-ink-200 pt-3 text-[13px] leading-relaxed text-ink-600">
            내부 커뮤니티 그룹({data.group_email})에는 로그인 시 자동 등록됩니다
            {data.joined && (
              <>
                {" — "}
                <span className="inline-flex items-center gap-1 text-success-700">
                  등록 확인됨
                  <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </span>
              </>
            )}
            . 별도 작업이 필요 없습니다.
          </p>
        </>
      )}
    </section>
  );
}
