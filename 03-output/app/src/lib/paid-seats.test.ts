import { describe, expect, test } from "vitest";
import {
  PAID_SEAT_REWARD,
  openSeatCount,
  pickOrderWithOpenSeat,
  seatNoticeText,
} from "./paid-seats";

const orders = [
  { id: 2, app_id: 1, tester_count: 2, created_at: "2026-10-02T00:00:00Z" },
  { id: 1, app_id: 1, tester_count: 3, created_at: "2026-10-01T00:00:00Z" },
];

describe("pickOrderWithOpenSeat", () => {
  test("오래된 주문부터 채운다", () => {
    expect(pickOrderWithOpenSeat(orders, new Map())?.id).toBe(1);
  });

  test("가득 찬 주문은 건너뛴다", () => {
    expect(pickOrderWithOpenSeat(orders, new Map([[1, 3]]))?.id).toBe(2);
  });

  test("전부 찼으면 null", () => {
    expect(
      pickOrderWithOpenSeat(
        orders,
        new Map([
          [1, 3],
          [2, 2],
        ]),
      ),
    ).toBeNull();
  });
});

describe("openSeatCount", () => {
  test("열린 시트 합계", () => {
    expect(openSeatCount(orders, new Map([[1, 1]]))).toBe(4);
  });

  test("초과 배정은 0으로 취급", () => {
    expect(openSeatCount(orders, new Map([[1, 5]]))).toBe(2);
  });
});

describe("seatNoticeText", () => {
  test("보상·링크·리뷰 금지 문구 포함", () => {
    const text = seatNoticeText({ appName: "가계부", appId: 7, seats: 3 });
    expect(text).toContain("가계부");
    expect(text).toContain(`${PAID_SEAT_REWARD.toLocaleString("ko-KR")} 크레딧`);
    expect(text).toContain("/browse/7");
    expect(text).toContain("리뷰");
  });
});

describe("PAID_SEAT_REWARD", () => {
  test("50원 × 14일 = 700", () => {
    expect(PAID_SEAT_REWARD).toBe(700);
  });
});
