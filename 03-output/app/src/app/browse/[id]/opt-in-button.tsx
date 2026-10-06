"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEAT_REWARD_MAX, SEAT_REWARD_SUMMARY } from "@/lib/seat-reward-rules";

type Props = {
  appId: number;
  alreadyJoined: boolean;
  isOwn: boolean;
  isFull: boolean;
  /** 열린 유료 시트 수 — 0 보다 크면 참여 시 유료 시트로 배정된다 (ADR-0012) */
  openSeats?: number;
};

const SEAT_RULES = [
  "14일간 매일 앱을 실행하고 실행 화면 스크린샷 1장과 함께 체크인합니다.",
  `보상: ${SEAT_REWARD_SUMMARY}.`,
  "12일 이상 출석해야 보상을 받습니다. 결석이 3일이 되거나 3일차까지 첫 체크인이 없으면 시트가 해제되고 보상은 없습니다. 같은 앱의 유료 시트는 한 번만 참여할 수 있습니다.",
  "보상은 완주 후 구매자가 확정하거나, 3일간 응답이 없으면 자동으로 지급됩니다.",
  "이 앱에 리뷰·별점을 남기지 않습니다. 위반 시 보상이 몰수됩니다.",
  "스크린샷은 앱 등록자와 운영팀에 공개됩니다. 개인정보가 보이지 않게 찍어주세요.",
  "크레딧은 5,000부터 기프티콘·네이버페이 포인트 교환, 또는 내 앱 테스터 시트 열기(1,100 = 1명)에 쓸 수 있습니다. 구매·양도·현금 환급은 없습니다.",
  "설치가 안 되면 72시간 안에 [설치가 안 돼요]로 신고하세요. 신뢰도 차감 없이 빠질 수 있습니다.",
];

export function OptInButton({ appId, alreadyJoined, isOwn, isFull, openSeats = 0 }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const paidSeat = openSeats > 0;

  if (isOwn) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-500"
      >
        본인 앱에는 참여할 수 없습니다
      </button>
    );
  }

  if (alreadyJoined) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-mint-500/10 px-5 py-3 text-sm font-semibold text-mint-500"
      >
        이미 참여중 — 내 테스트에서 확인
      </button>
    );
  }

  if (isFull && !paidSeat) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-500"
      >
        정원 마감
      </button>
    );
  }

  async function onClick() {
    setBusy(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string; paid_seat?: boolean };
    if (!res.ok || !data.ok) {
      alert(data.message ?? "참여에 실패했습니다.");
      setBusy(false);
      return;
    }
    if (paidSeat && data.paid_seat === false) {
      alert("방금 유료 시트가 마감되어 일반(무료) 참여로 등록되었습니다. 크레딧 보상은 없습니다.");
    }
    router.push(`/browse/${appId}`);
    router.refresh();
  }

  return (
    <div>
      {paidSeat && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            💰 유료 시트 {openSeats}명 모집 중 — 최대 {SEAT_REWARD_MAX} 크레딧
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-900">
            {SEAT_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-900">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            위 규칙을 확인했고 동의합니다
          </label>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={busy || (paidSeat && !agreed)}
        className="w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {busy ? "처리 중..." : paidSeat ? "유료 시트로 참여하기" : "이 앱 테스트에 참여하기"}
      </button>
    </div>
  );
}
