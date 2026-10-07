import { Check, X } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { SEAT_TOTAL_DAYS } from "@/lib/seat-reward-rules";

export type DayState = "done" | "today" | "missed" | "upcoming";

const STATE_TEXT: Record<DayState, string> = {
  done: "체크인 완료",
  today: "오늘",
  missed: "결석",
  upcoming: "예정",
};

/** 셀 모양 — 색만이 아니라 면·선 두께·점선·아이콘으로 구분한다 */
const CELL: Record<DayState, string> = {
  done: "border border-ink-900 bg-ink-900 text-white",
  today: "border-[1.5px] border-accent-600 bg-white text-ink-900",
  missed: "border border-dashed border-ink-900 bg-white text-ink-700",
  upcoming: "border border-ink-200 bg-white text-ink-600",
};

/**
 * n일차의 상태.
 * @param elapsedDays 이미 지나간 날 수 (오늘 제외). 기간이 끝났으면 SEAT_TOTAL_DAYS.
 * @param todayDayN 오늘 일차 (기간 밖이면 0)
 */
export function dayState(
  day: number,
  checked: ReadonlySet<number>,
  todayDayN: number,
  elapsedDays: number,
): DayState {
  if (checked.has(day)) return "done";
  if (day === todayDayN) return "today";
  if (day <= elapsedDays) return "missed";
  return "upcoming";
}

function CellMark({ state }: { state: DayState }) {
  if (state === "done") return <Check className="size-3.5" strokeWidth={2.2} aria-hidden="true" />;
  if (state === "missed") return <X className="size-3.5" strokeWidth={2} aria-hidden="true" />;
  if (state === "today")
    return (
      <span aria-hidden="true" className="text-[10px] leading-none">
        오늘
      </span>
    );
  return <span aria-hidden="true" className="h-3.5" />;
}

/** 14칸 체크인 달력 — mono 일차 번호 + 모양으로 상태 표시, 스크린 리더에는 글자로 읽힌다 */
export function CheckinCalendar({
  checkedDays,
  todayDayN,
  elapsedDays,
}: {
  checkedDays: ReadonlySet<number>;
  todayDayN: number;
  elapsedDays: number;
}) {
  const days = Array.from({ length: SEAT_TOTAL_DAYS }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label={`${SEAT_TOTAL_DAYS}일 체크인 달력`}
        className="m-0 grid list-none grid-cols-7 gap-1 p-0 font-mono tabular-nums"
      >
        {days.map((day) => {
          const state = dayState(day, checkedDays, todayDayN, elapsedDays);
          return (
            <li
              key={day}
              className={cx(
                "flex h-11 flex-col items-center justify-center gap-0.5 text-xs",
                CELL[state],
              )}
            >
              <span aria-hidden="true">{String(day).padStart(2, "0")}</span>
              <CellMark state={state} />
              <span className="sr-only">
                {day}일차 {STATE_TEXT[state]}
              </span>
            </li>
          );
        })}
      </ol>
      <ul
        className="text-ink-600 m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs"
        aria-hidden="true"
      >
        {(Object.keys(STATE_TEXT) as DayState[]).map((state) => (
          <li key={state} className="inline-flex items-center gap-1.5">
            <span className={cx("inline-block size-3", CELL[state])} />
            {STATE_TEXT[state]}
          </li>
        ))}
      </ul>
    </div>
  );
}
