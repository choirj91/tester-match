import {
  AlarmClock,
  Bell,
  BellOff,
  Hourglass,
  MessageSquare,
  PartyPopper,
  Rocket,
  SquarePen,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

/** 알림 목록·종 팝업 공용 */
export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

/** 알림 종류별 아이콘 (stroke) — 이모지를 쓰지 않는다 */
const TYPE_ICON: Readonly<Record<string, LucideIcon>> = {
  match_new: UserPlus,
  match_reminder: AlarmClock,
  match_completed: PartyPopper,
  match_penalized: TriangleAlert,
  comment_new: MessageSquare,
  post_comment: SquarePen,
  boost_expiring: Hourglass,
  boost_expired: BellOff,
  group_upgrade: Rocket,
};

export function notificationIcon(type: string): LucideIcon {
  return TYPE_ICON[type] ?? Bell;
}

export function formatRelative(dateStr: string): string {
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
