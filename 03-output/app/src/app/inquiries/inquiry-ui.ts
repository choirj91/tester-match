import type { InquiryStatus } from "@/lib/validators/inquiry";

/** 상태 배지 색 — 사용자 화면과 관리자 화면이 같이 쓴다 */
export const INQUIRY_STATUS_TONE: Record<InquiryStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-sky-100 text-sky-800",
  answered: "bg-emerald-100 text-emerald-800",
  closed: "bg-neutral-100 text-neutral-500",
};

export function formatKst(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
}
