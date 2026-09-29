import { describe, expect, test } from "vitest";
import {
  attendanceRate,
  dayDateLabel,
  orderDayN,
  screenshotObjectPath,
} from "./console";

describe("orderDayN (KST 달력일 기준)", () => {
  test("미개시 주문은 null", () => {
    expect(orderDayN(null)).toBeNull();
  });

  test("개시 당일은 1일차", () => {
    const started = "2026-09-28T05:00:00Z"; // KST 14:00
    expect(orderDayN(started, new Date("2026-09-28T13:00:00Z"))).toBe(1); // KST 22:00
  });

  test("KST 자정을 넘기면 2일차 (UTC 기준으로는 같은 날)", () => {
    const started = "2026-09-28T14:59:00Z"; // KST 23:59
    expect(orderDayN(started, new Date("2026-09-28T15:01:00Z"))).toBe(2); // KST 00:01 다음날
  });

  test("14일 상한", () => {
    const started = "2026-09-01T00:00:00Z";
    expect(orderDayN(started, new Date("2026-10-30T00:00:00Z"))).toBe(14);
  });

  test("시계 역행이어도 1 미만으로 내려가지 않는다", () => {
    const started = "2026-09-28T05:00:00Z";
    expect(orderDayN(started, new Date("2026-09-20T05:00:00Z"))).toBe(1);
  });
});

describe("dayDateLabel", () => {
  test("개시일 KST 날짜에서 일차만큼 더한다", () => {
    const started = "2026-09-30T15:30:00Z"; // KST 10/1 00:30
    expect(dayDateLabel(started, 1)).toBe("10/1");
    expect(dayDateLabel(started, 3)).toBe("10/3");
  });
});

describe("attendanceRate", () => {
  test("경과 일차 × 슬롯 대비 done 비율", () => {
    const logs = [{ status: "done" as const }, { status: "done" as const }, { status: "missed" as const }];
    expect(attendanceRate(logs, 2, 2)).toBe(50);
  });

  test("미개시·슬롯 0 은 0", () => {
    expect(attendanceRate([], 3, null)).toBe(0);
    expect(attendanceRate([], 0, 5)).toBe(0);
  });
});

describe("screenshotObjectPath", () => {
  test("주문/슬롯/일차 경로", () => {
    expect(screenshotObjectPath(2, 3, 7, "png")).toBe("orders/2/slot3/day7.png");
  });
});
