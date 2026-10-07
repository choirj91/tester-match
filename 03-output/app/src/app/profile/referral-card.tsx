"use client";

import { useState } from "react";

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
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">친구 초대</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        초대한 친구가 첫 유료 테스트(급구 시트)를 14일 완주하면 나와 친구 모두 신뢰도 +{trustDelta}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          value={link}
          aria-label="내 초대 링크"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
        >
          {copied ? "✓ 복사됨" : "링크 복사"}
        </button>
      </div>
      {copyFailed && (
        <p className="mt-1 text-xs text-crimson-500">복사하지 못했습니다. 칸을 눌러 직접 복사해주세요.</p>
      )}

      <p className="mt-4 text-sm font-medium text-neutral-800 tabular">
        {stats
          ? `초대 ${stats.invited}명 · 첫 유료 테스트 완주 ${stats.completed}명`
          : "초대 현황을 불러오지 못했습니다. 새로고침해주세요."}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
        링크로 들어온 친구가 {linkDays}일 안에 처음 가입해야 초대로 집계됩니다. 나나 친구가 결제한 테스트로
        완주한 경우는 제외되고, 신뢰도는 {capWindowDays}일에 {capPerWindow}명까지 오릅니다.
      </p>
    </section>
  );
}
