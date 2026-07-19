"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, AD_SLOTS, type AdSlotKey } from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 반응형 디스플레이 광고 유닛.
 * - 슬롯 ID 설정됨 → 실제 광고 렌더링 (전체 사용자)
 * - 슬롯 비어있음 + preview(관리자) 또는 로컬 dev → 점선 플레이스홀더
 * - 슬롯 비어있음 + 일반 사용자 → 아무것도 렌더링 안 함
 */
export function AdUnit({ slot, preview = false }: { slot: AdSlotKey; preview?: boolean }) {
  const slotId = AD_SLOTS[slot];
  const pushed = useRef(false);
  const showPlaceholder =
    !slotId && (preview || process.env.NODE_ENV === "development");

  useEffect(() => {
    if (!slotId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle 로더 미로드 등 — 무시
    }
  }, [slotId]);

  if (!slotId && !showPlaceholder) return null;

  if (showPlaceholder) {
    return (
      <div className="my-8 flex min-h-[100px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-4 py-6">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-500">
          AD PLACEHOLDER
        </p>
        <p className="text-sm font-semibold text-amber-700">
          광고 위치: <code className="font-mono">{slot}</code>
        </p>
        <p className="text-[11px] text-amber-500">
          반응형 디스플레이 · 슬롯 ID 설정 시 실제 광고로 교체됩니다 (관리자에게만 표시)
        </p>
      </div>
    );
  }

  return (
    <div className="my-8 flex min-h-[100px] items-center justify-center overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
