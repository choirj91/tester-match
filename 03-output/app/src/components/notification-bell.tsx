"use client";

import { ArrowRight, Bell, Inbox, LoaderCircle } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  formatRelative,
  notificationIcon,
  type Notification,
} from "@/app/notifications/notification-meta";

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
        className="relative inline-flex size-11 items-center justify-center text-ink-900 transition-colors hover:bg-surface-1"
      >
        <Bell className="size-5" strokeWidth={1.8} aria-hidden="true" />

        {count > 0 && (
          <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center bg-danger-700 px-1 font-mono text-[10px] leading-none font-medium text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* 드롭다운 팝업 */}
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-32px)] border border-ink-900 bg-white">
          {/* 헤더 */}
          <div className="border-b border-ink-900 px-4 py-3">
            <p className="m-0 font-display text-base font-semibold text-ink-900">알림</p>
          </div>

          {/* 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div role="status" className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-700">
                <LoaderCircle className="size-6 animate-spin text-ink-900" strokeWidth={1.7} aria-hidden="true" />
                불러오는 중…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-700">
                <Inbox className="size-6 text-ink-900" strokeWidth={1.7} aria-hidden="true" />
                <p className="m-0">새로운 알림이 없습니다.</p>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {notifications.map((n) => {
                  const Icon = notificationIcon(n.type);
                  const inner = (
                    <div className="flex gap-3 px-4 py-3">
                      <Icon className="mt-0.5 size-[18px] shrink-0 text-ink-900" strokeWidth={1.7} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate text-sm font-bold text-ink-900">
                          {!n.is_read && <span className="sr-only">읽지 않음 · </span>}
                          {n.title}
                        </p>
                        <p className="m-0 mt-0.5 line-clamp-2 text-xs text-ink-700">{n.body}</p>
                        <p className="m-0 mt-1 font-mono text-[11px] text-ink-600">{formatRelative(n.created_at)}</p>
                      </div>
                      {!n.is_read && <span className="mt-1.5 size-2 shrink-0 bg-ink-900" aria-hidden="true" />}
                    </div>
                  );

                  return (
                    <li key={n.id} className={`border-b border-ink-200 last:border-b-0 ${n.is_read ? "" : "bg-surface-1"}`}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => setOpen(false)}
                          className="block text-ink-900 no-underline transition-colors hover:bg-surface-1"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="hover:bg-surface-1">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 푸터 — 전체 알림 페이지 이동 */}
          <div className="border-t border-ink-900">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 px-4 text-sm font-medium text-ink-900 no-underline transition-colors hover:bg-surface-1 hover:text-accent-600"
            >
              전체 알림 보기
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
