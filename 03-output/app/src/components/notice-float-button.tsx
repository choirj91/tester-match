"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 공지사항 플로팅 버튼.
 * 안 읽은 공지가 있으면 버밀리언 배지로 건수를 표시한다.
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

  const label = unread > 0 ? `공지사항 보기 (안 읽은 공지 ${unread}건)` : "공지사항 보기";
  return (
    <Link
      href="/board?category=%EA%B3%B5%EC%A7%80"
      aria-label={label}
      title={label}
      className="relative flex size-11 items-center justify-center bg-ink-900 text-white hover:bg-black"
    >
      <Megaphone className="size-5" strokeWidth={1.8} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-4 items-center justify-center bg-accent-600 px-1 font-mono text-[10px] leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
