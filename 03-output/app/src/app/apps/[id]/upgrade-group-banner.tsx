"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";

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
      <section className="mt-8 rounded-2xl border border-mint-500/40 bg-mint-500/5 p-6">
        <p className="text-sm font-semibold text-mint-500">
          ✓ 공용 테스터 그룹으로 전환되었습니다
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
          마지막 한 단계 — Play Console → 테스트 → 비공개 테스트 트랙 → 테스터 목록에{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] font-semibold text-trust-700">
            {PLAY_GROUP_EMAIL}
          </code>{" "}
          을 추가해주세요. 이후 테스터 관리는 완전 자동입니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-trust-500/40 bg-trust-50 p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-trust-600 px-2 py-0.5 text-[10px] font-bold text-white">
          새 기능
        </span>
        <h2 className="text-lg font-semibold text-neutral-900">
          공용 테스터 그룹으로 업그레이드
        </h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
        이 앱은 아직 이전 방식(개별 Google 그룹)을 사용하고 있습니다. 공용 그룹으로
        전환하면 <strong>테스터가 그룹 가입 절차 없이 로그인만으로 바로 참여</strong>할 수
        있고, 테스터 이메일 관리가 완전히 자동화됩니다.
      </p>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-neutral-600">
        <li className="flex gap-1.5">
          <span className="shrink-0 font-bold text-trust-600">•</span>
          Tester Match 회원 전체가 자동으로 승인된 테스터가 됩니다
        </li>
        <li className="flex gap-1.5">
          <span className="shrink-0 font-bold text-trust-600">•</span>
          새 테스터 참여 시 Play Console 에서 이메일을 추가할 필요가 없습니다
        </li>
        <li className="flex gap-1.5">
          <span className="shrink-0 font-bold text-trust-600">•</span>
          전환 후 Play Console 테스터 목록에{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] font-semibold text-trust-700">
            {PLAY_GROUP_EMAIL}
          </code>{" "}
          한 줄만 추가하면 끝
        </li>
      </ul>
      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className="mt-4 rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-trust-700 disabled:opacity-50"
      >
        {busy ? "전환 중..." : "공용 그룹으로 전환하기"}
      </button>
    </section>
  );
}
