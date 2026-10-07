"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
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
  "보상은 완주 후 개발자가 확정하거나, 3일간 응답이 없으면 자동으로 지급됩니다.",
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
      <Button disabled className="w-full">
        본인 앱에는 참여할 수 없습니다
      </Button>
    );
  }

  if (alreadyJoined) {
    return (
      <p className="m-0 flex min-h-12 w-full items-center justify-center gap-2 border border-ink-900 bg-white px-5 text-[15px] font-medium text-success-700">
        <Check className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        이미 참여중 — 내 테스트에서 확인
      </p>
    );
  }

  if (isFull && !paidSeat) {
    return (
      <Button disabled className="w-full">
        정원 마감
      </Button>
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
    <div className="flex flex-col gap-3">
      {paidSeat && (
        <Notice kind="caution" title={`유료 시트 ${openSeats}명 모집 중 — 최대 ${SEAT_REWARD_MAX} 크레딧`}>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-ink-900">
            {SEAT_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <Checkbox
            className="mt-2 font-semibold"
            label="위 규칙을 확인했고 동의합니다"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
        </Notice>
      )}
      <Button
        onClick={onClick}
        loading={busy}
        disabled={paidSeat && !agreed}
        className="w-full"
      >
        {paidSeat ? "유료 시트로 참여하기" : "이 앱 테스트에 참여하기"}
      </Button>
    </div>
  );
}
