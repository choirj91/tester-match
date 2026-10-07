"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

type Props = {
  link: string;
  /** 초대 수·완주 수. 읽지 못했으면 null */
  stats: { invited: number; completed: number } | null;
  trustDelta: number;
  /** 링크를 연 뒤 가입까지 인정하는 기간 (추천 쿠키 수명) */
  linkDays: number;
  /** 추천인 지급 상한 — capWindowDays 일에 capPerWindow 명 (판정은 DB 함수) */
  capPerWindow: number;
  capWindowDays: number;
};

/** 친구 초대 카드 (ADR-0019) — 신뢰도만 오른다. 크레딧·기프티콘 등 금전 보상 문구를 쓰지 않는다. */
export function ReferralCard({ link, stats, trustDelta, linkDays, capPerWindow, capWindowDays }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드 권한이 없으면 칸을 선택해 직접 복사하도록 안내한다
      setCopyFailed(true);
    }
  }

  return (
    <section aria-labelledby="referral-title" className="flex flex-col gap-4 border-t border-ink-900 pt-6">
      <h2 id="referral-title" className="m-0 font-display text-h3 font-semibold text-ink-900">
        친구 초대
      </h2>
      <p className="m-0 text-[15px] leading-relaxed text-ink-700">
        초대한 친구가 첫 유료 테스트(급구 시트)를 14일 완주하면 나와 친구 모두 신뢰도 +{trustDelta}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          readOnly
          value={link}
          aria-label="내 초대 링크"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 font-mono text-sm"
        />
        <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
          {copied ? (
            <>
              <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              복사됨
            </>
          ) : (
            "링크 복사"
          )}
        </Button>
      </div>
      {copyFailed && (
        <p role="alert" className="m-0 text-[13px] text-danger-700">
          복사하지 못했습니다. 칸을 눌러 직접 복사해주세요.
        </p>
      )}

      <p className="m-0 font-mono text-sm text-ink-900 tabular">
        {stats
          ? `초대 ${stats.invited}명 · 첫 유료 테스트 완주 ${stats.completed}명`
          : "초대 현황을 불러오지 못했습니다. 새로고침해주세요."}
      </p>
      <p className="m-0 border-t border-ink-200 pt-3 text-[13px] leading-relaxed text-ink-600">
        링크로 들어온 친구가 {linkDays}일 안에 처음 가입해야 초대로 집계됩니다. 나나 친구가 결제한 테스트로
        완주한 경우는 제외되고, 신뢰도는 {capWindowDays}일에 {capPerWindow}명까지 오릅니다.
      </p>
    </section>
  );
}
