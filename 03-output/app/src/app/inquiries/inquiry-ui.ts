import type { InquiryStatus } from "@/lib/validators/inquiry";

/** 상태 배지 색 — 사용자 화면과 관리자 화면이 같이 쓴다 */
export const INQUIRY_STATUS_TONE: Record<InquiryStatus, string> = {
  open: "bg-warning-50 text-warning-700",
  in_progress: "bg-surface-1 text-ink-900",
  answered: "bg-success-50 text-success-700",
  closed: "bg-surface-1 text-ink-600",
};

export function formatKst(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}
