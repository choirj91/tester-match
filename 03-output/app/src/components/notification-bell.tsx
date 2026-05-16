"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?count=1", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { count?: number };
        setCount(data.count ?? 0);
      }
    } catch {
      // 네트워크 오류 무시
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      title="알림"
    >
      {/* Bell icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
