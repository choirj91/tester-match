/**
 * 유료 테스터 콘솔 (ADR-0011) — 순수 헬퍼. 14일 카운트는 KST 날짜 기준.
 */

export const CONSOLE_TOTAL_DAYS = 14;
export const SCREENSHOT_BUCKET = "paid-order-screenshots";
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type LogStatus = "done" | "missed";

export type ConsoleSlot = { id: number; slot_no: number; label: string };
export type ConsoleLog = {
  id: number;
  slot_id: number;
  day_n: number;
  status: LogStatus;
  comment: string;
  screenshot_path: string | null;
  updated_at: string;
};

/** KST 자정 기준 일 단위 정수 (날짜 비교용) */
function kstDayIndex(date: Date): number {
  return Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);
}

/** 개시일을 1일차로, KST 달력일 기준 현재 일차 (1~14). 미개시면 null. */
export function orderDayN(startedAtIso: string | null, now: Date = new Date()): number | null {
  if (!startedAtIso) return null;
  const diff = kstDayIndex(now) - kstDayIndex(new Date(startedAtIso));
  return Math.min(CONSOLE_TOTAL_DAYS, Math.max(1, diff + 1));
}

/** n일차의 KST 날짜 라벨 'M/D' */
export function dayDateLabel(startedAtIso: string, dayN: number): string {
  const d = new Date(new Date(startedAtIso).getTime() + KST_OFFSET_MS + (dayN - 1) * DAY_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** 출석률 % — 경과 일차 × 슬롯 수 대비 done 로그 수 */
export function attendanceRate(
  logs: ReadonlyArray<Pick<ConsoleLog, "status">>,
  slotCount: number,
  dayN: number | null,
): number {
  if (!dayN || slotCount === 0) return 0;
  const expected = slotCount * dayN;
  const done = logs.filter((l) => l.status === "done").length;
  return Math.min(100, Math.round((done / expected) * 100));
}

export function screenshotObjectPath(
  orderId: number,
  slotNo: number,
  dayN: number,
  ext: string,
): string {
  return `orders/${orderId}/slot${slotNo}/day${dayN}.${ext}`;
}
