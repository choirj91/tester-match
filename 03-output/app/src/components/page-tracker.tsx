"use client";

import { useEffect } from "react";

/**
 * 방문자 추적 컴포넌트 — 루트 레이아웃에 삽입.
 * localStorage 에 tm_sid 세션 ID 를 저장하고,
 * 페이지 로드마다 /api/track 에 POST (서버에서 중복 제거).
 */
export function PageTracker() {
  useEffect(() => {
    try {
      let sid = localStorage.getItem("tm_sid");
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("tm_sid", sid);
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      }).catch(() => {});
    } catch {
      // localStorage 차단 환경(시크릿 모드 등) — 무시
    }
  }, []);

  return null;
}
