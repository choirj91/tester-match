"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * 레거시 앱(개별 그룹/그룹 없음)용 공용 그룹 전환 배너.
 * 전환 = PATCH 로 google_group_url 을 공용 그룹으로 교체 (서버에서도 강제).
 */
export function UpgradeGroupBanner({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function upgrade() {
    setBusy(true);
    const res = await fetch(`/api/apps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ google_group_url: TESTER_GROUP_URL }),
    });
    if (!res.ok) {
      alert("전환에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    router.refresh();
  }

  if (done) {
    return (
      <section role="status" className="mt-12 border-t border-ink-900 pt-8">
        <p className="flex items-center gap-2 text-[15px] font-bold text-success-700">
          <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
          공용 테스터 그룹으로 전환되었습니다
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          마지막 한 단계 — Play Console → 테스트 → 비공개 테스트 트랙 → 테스터 목록에{" "}
          <code className="break-all bg-surface-1 px-1 py-0.5 font-mono text-[13px] text-ink-900">
            {PLAY_GROUP_EMAIL}
          </code>{" "}
          을 추가해주세요. 이후 테스터 관리는 완전 자동입니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 border-t border-ink-900 pt-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="m-0 font-display text-h2 font-semibold text-ink-900">
          공용 테스터 그룹으로 업그레이드
        </h2>
        <Badge tone="ink">새 기능</Badge>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
        이 앱은 아직 이전 방식(개별 Google 그룹)을 사용하고 있습니다. 공용 그룹으로
        전환하면 <strong className="text-ink-900">테스터가 그룹 가입 절차 없이 로그인만으로 바로 참여</strong>할 수
        있고, 테스터 이메일 관리가 완전히 자동화됩니다.
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-700 marker:text-ink-900">
        <li>Tester Match 회원 전체가 자동으로 승인된 테스터가 됩니다</li>
        <li>새 테스터 참여 시 Play Console 에서 이메일을 추가할 필요가 없습니다</li>
        <li>
          전환 후 Play Console 테스터 목록에{" "}
          <code className="break-all bg-surface-1 px-1 py-0.5 font-mono text-[13px] text-ink-900">
            {PLAY_GROUP_EMAIL}
          </code>{" "}
          한 줄만 추가하면 끝
        </li>
      </ul>
      <Button onClick={upgrade} loading={busy} className="mt-5">
        {busy ? "전환 중..." : "공용 그룹으로 전환하기"}
      </Button>
    </section>
  );
}
