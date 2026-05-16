"use client";

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

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center text-neutral-400">
        <span className="text-4xl">🔔</span>
        <p className="mt-3 text-sm">새로운 알림이 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {notifications.map((n) => {
        const icon = TYPE_ICON[n.type] ?? "🔔";
        const inner = (
          <div className="flex gap-3 px-4 py-4">
            <span className="mt-0.5 text-xl leading-none">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{n.title}</p>
              <p className="mt-0.5 text-sm text-neutral-600 line-clamp-2">{n.body}</p>
              <p className="mt-1 text-xs text-neutral-400">{formatRelative(n.created_at)}</p>
            </div>
          </div>
        );

        return (
          <li key={n.id} className={n.is_read ? "bg-white" : "bg-trust-50/40"}>
            {n.link ? (
              <Link href={n.link} className="block hover:bg-neutral-50 transition-colors">
                {inner}
              </Link>
            ) : (
              <div>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
