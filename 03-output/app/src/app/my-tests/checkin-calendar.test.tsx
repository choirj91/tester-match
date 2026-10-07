import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SEAT_TOTAL_DAYS } from "@/lib/seat-reward-rules";
import { CheckinCalendar, dayState } from "./checkin-calendar";

describe("dayState", () => {
  const checked = new Set([1, 2, 4]);

  test("체크인한 날은 오늘이어도 완료", () => {
    expect(dayState(4, checked, 4, 3)).toBe("done");
  });

  test("오늘 아직 안 했으면 오늘, 지나간 빈 날은 결석, 남은 날은 예정", () => {
    expect(dayState(5, checked, 5, 4)).toBe("today");
    expect(dayState(3, checked, 5, 4)).toBe("missed");
    expect(dayState(6, checked, 5, 4)).toBe("upcoming");
  });

  test("기간이 끝났으면 (오늘 0, 지나간 날 = 전체) 빈 날은 모두 결석", () => {
    expect(dayState(SEAT_TOTAL_DAYS, checked, 0, SEAT_TOTAL_DAYS)).toBe("missed");
  });
});

describe("CheckinCalendar", () => {
  test(`${SEAT_TOTAL_DAYS}칸을 그리고 상태를 글자로 읽어 준다`, () => {
    render(<CheckinCalendar checkedDays={new Set([1])} todayDayN={2} elapsedDays={1} />);

    const list = screen.getByRole("list", { name: `${SEAT_TOTAL_DAYS}일 체크인 달력` });
    expect(list.querySelectorAll("li")).toHaveLength(SEAT_TOTAL_DAYS);
    expect(screen.getByText("1일차 체크인 완료")).toBeInTheDocument();
    expect(screen.getByText("2일차 오늘")).toBeInTheDocument();
    expect(screen.getByText("3일차 예정")).toBeInTheDocument();
  });
});
