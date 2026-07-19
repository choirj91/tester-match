"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, string> = {
  match_new: "🧑‍💻",
  match_reminder: "⏰",
  match_completed: "🎉",
  match_penalized: "⚠️",
  comment_new: "💬",
  post_comment: "📝",
  boost_expiring: "⏳",
  boost_expired: "🔕",
  group_upgrade: "🚀",
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 60초마다 미읽음 수 폴링
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?count=1", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { count?: number };
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

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 팝업 열기 — 목록 fetch + 전체 읽음 처리
  const handleToggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setLoading(true);
    try {
      const [listRes] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store" }),
        count > 0 ? fetch("/api/notifications", { method: "PATCH" }) : Promise.resolve(),
      ]);
      if (listRes.ok) {
        const data = (await listRes.json()) as { notifications?: Notification[] };
        setNotifications(data.notifications ?? []);
        setCount(0);
      }
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  }, [open, count]);

  return (
    <div ref={wrapperRef} className="relative">
      {/* 벨 버튼 */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="알림"
        aria-expanded={open}
        className="relative inline-flex items-center rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
      >
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
      </button>

      {/* 드롭다운 팝업 */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          {/* 헤더 */}
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">알림</p>
          </div>

          {/* 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-neutral-400">
                불러오는 중…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <span className="text-3xl">🔔</span>
                <p className="mt-2 text-sm">새로운 알림이 없습니다.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {notifications.map((n) => {
                  const icon = TYPE_ICON[n.type] ?? "🔔";
                  const inner = (
                    <div className="flex gap-3 px-4 py-3">
                      <span className="mt-0.5 shrink-0 text-lg leading-none">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{n.body}</p>
                        <p className="mt-1 text-[11px] text-neutral-400">{formatRelative(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-trust-500" />
                      )}
                    </div>
                  );

                  return (
                    <li key={n.id} className={n.is_read ? "" : "bg-trust-50/30"}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => setOpen(false)}
                          className="block transition-colors hover:bg-neutral-50"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="hover:bg-neutral-50">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 푸터 — 전체 알림 페이지 이동 */}
          <div className="border-t border-neutral-100 p-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-trust-600 transition-colors hover:bg-trust-50"
            >
              전체 알림 보기
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
