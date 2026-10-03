import { describe, expect, test } from "vitest";
import {
  PAID_SEAT_REWARD,
  fillDeadline,
  openSeatCount,
  orderSettlement,
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
    expect(text).toContain("설치 인증 100");
    expect(text).toContain("출석 20/일");
    expect(text).toContain(`최대 ${PAID_SEAT_REWARD.toLocaleString("ko-KR")}`);
    expect(text).toContain("/browse/7");
    expect(text).toContain("리뷰");
  });
});

describe("PAID_SEAT_REWARD", () => {
  test("마일스톤 합계 상한 = 700 (완주 600 + 출시 100)", () => {
    expect(PAID_SEAT_REWARD).toBe(700);
  });
});

describe("fillDeadline", () => {
  test("결제 후 7일", () => {
    expect(fillDeadline("2026-10-01T00:00:00Z").toISOString()).toBe("2026-10-08T00:00:00.000Z");
  });
});

describe("orderSettlement", () => {
  test("진행 중 테스터가 있으면 열림", () => {
    expect(orderSettlement({ seatsClosed: true, testerCount: 3, active: 1, completed: 2 })).toBe("open");
  });

  test("전 시트 완주면 완료", () => {
    expect(orderSettlement({ seatsClosed: false, testerCount: 3, active: 0, completed: 3 })).toBe(
      "completed",
    );
  });

  test("충원 기간 중 빈 시트가 있으면 열림 유지", () => {
    expect(orderSettlement({ seatsClosed: false, testerCount: 3, active: 0, completed: 1 })).toBe("open");
  });

  test("마감 후 일부만 완주해도 완료 (나머지는 환불됨)", () => {
    expect(orderSettlement({ seatsClosed: true, testerCount: 3, active: 0, completed: 1 })).toBe(
      "completed",
    );
  });

  test("마감 후 완주가 하나도 없으면 취소", () => {
    expect(orderSettlement({ seatsClosed: true, testerCount: 3, active: 0, completed: 0 })).toBe(
      "canceled",
    );
  });
});
