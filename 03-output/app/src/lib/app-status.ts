/**
 * 앱 상태 라이프사이클 (ADR-0006).
 * 'completed' 는 레거시 — 라벨은 '심사중' 으로 통합 표시.
 */

export type AppStatus =
  | "draft"
  | "matching"
  | "reviewing"
  | "launched"
  | "completed"
  | "paused"
  | "deleted";

export const APP_STATUS_LABEL: Record<
  AppStatus,
  { text: string; tone: string }
> = {
  draft: { text: "대기", tone: "bg-neutral-100 text-neutral-700" },
  matching: { text: "모집중", tone: "bg-trust-50 text-trust-700" },
  reviewing: { text: "심사중", tone: "bg-amber-500/10 text-amber-500" },
  launched: { text: "출시 완료", tone: "bg-mint-500/10 text-mint-500" },
  completed: { text: "심사중", tone: "bg-amber-500/10 text-amber-500" }, // 레거시
  paused: { text: "일시정지", tone: "bg-neutral-100 text-neutral-500" },
  deleted: { text: "삭제됨", tone: "bg-neutral-100 text-neutral-500" },
};

/** /browse 정렬 우선순위 (모집중 → 심사중 → 출시 완료). 기타 상태는 노출 안 함. */
export const BROWSE_STATUSES: readonly AppStatus[] = [
  "matching",
  "reviewing",
  "launched",
];

export const APP_STATUS_ORDER: Record<string, number> = {
  matching: 0,
  reviewing: 1,
  completed: 1, // 레거시 — 심사중 그룹
  launched: 2,
};

/** 사용자가 dev 화면에서 직접 전환 가능한 상태. */
export const EDITABLE_APP_STATUSES: readonly { value: AppStatus; label: string }[] = [
  { value: "matching", label: "모집중" },
  { value: "reviewing", label: "심사중" },
  { value: "launched", label: "출시 완료" },
  { value: "paused", label: "일시정지" },
];
