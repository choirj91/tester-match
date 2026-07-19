"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 공지사항 플로팅 버튼.
 * 안 읽은 공지가 있으면 빨간 느낌표 배지 표시.
 * 클릭 → /board?category=공지 (목록 진입 시 서버에서 일괄 읽음 처리).
 */
export function NoticeFloatButton() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notices/unread", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { unread: 0 }))
      .then((data) => {
        const { unread: n } = data as { unread?: number };
        if (!cancelled) setUnread(n ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="group relative">
      <span className="pointer-events-none absolute right-full top-1/2 mr-2.5 -translate-y-1/2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        {unread > 0 ? `안 읽은 공지 ${unread}건` : "공지사항"}
      </span>
      <Link
        href="/board?category=%EA%B3%B5%EC%A7%80"
        aria-label="공지사항 보기"
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-neutral-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-95"
      >
        {/* 확성기 아이콘 */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
          <path d="M14 8a4 4 0 0 1 0 8" />
          <path d="M17 5a8 8 0 0 1 0 14" />
        </svg>

        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold leading-none text-white shadow">
            !
          </span>
        )}
      </Link>
    </div>
  );
}
