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
 * - 슬롯 ID 미설정(빈 문자열) → 아무것도 렌더링 안 함
 * - min-height 예약으로 CLS(레이아웃 흔들림) 완화
 */
export function AdUnit({ slot }: { slot: AdSlotKey }) {
  const slotId = AD_SLOTS[slot];
  const pushed = useRef(false);

  useEffect(() => {
    if (!slotId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle 로더 미로드 등 — 무시
    }
  }, [slotId]);

  if (!slotId) return null;

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
