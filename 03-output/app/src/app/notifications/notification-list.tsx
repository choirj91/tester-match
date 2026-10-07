"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/state";
import { formatRelative, notificationIcon, type Notification } from "./notification-meta";

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) {
    return <EmptyState title="새로운 알림이 없습니다." />;
  }

  return (
    <ul className="m-0 list-none border-t border-ink-900 p-0">
      {notifications.map((n) => {
        const Icon = notificationIcon(n.type);
        const inner = (
          <div className="flex gap-3 px-1 py-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-ink-900" strokeWidth={1.7} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[15px] font-bold text-ink-900">
                {!n.is_read && <span className="sr-only">읽지 않음 · </span>}
                {n.title}
              </p>
              <p className="m-0 mt-0.5 line-clamp-2 text-sm text-ink-700">{n.body}</p>
              <p className="m-0 mt-1 font-mono text-xs text-ink-600">{formatRelative(n.created_at)}</p>
            </div>
            {!n.is_read && <span className="mt-2 size-2 shrink-0 bg-ink-900" aria-hidden="true" />}
          </div>
        );

        return (
          <li key={n.id} className={`border-b border-ink-200 ${n.is_read ? "bg-white" : "bg-surface-1"}`}>
            {n.link ? (
              <Link href={n.link} className="block text-ink-900 no-underline transition-colors hover:bg-surface-1">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
