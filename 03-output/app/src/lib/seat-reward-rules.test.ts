import { describe, expect, test } from "vitest";
import {
  SEAT_REWARD_MAX,
  SEAT_REWARD_MAX_AT_COMPLETION,
  computeSeatReward,
  longestStreak,
  paidSeatVerdict,
} from "./seat-reward-rules";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("longestStreak", () => {
  test("끊긴 구간 중 가장 긴 연속", () => {
    expect(longestStreak([1, 2, 3, 5, 6, 7, 8, 9])).toBe(5);
  });
  test("중복·범위 밖 일차는 무시", () => {
    expect(longestStreak([1, 1, 2, 0, 15])).toBe(2);
  });
});

describe("computeSeatReward", () => {
  test("개근 = 100 + 280 + 50 + 120 + 50 = 600", () => {
    const r = computeSeatReward(range(1, 14));
    expect(r.total).toBe(600);
    expect(r.total).toBe(SEAT_REWARD_MAX_AT_COMPLETION);
    expect(SEAT_REWARD_MAX).toBe(700);
  });

  test("12일 완주 + 7연속 = 100 + 240 + 50 + 120 = 510", () => {
    // 1~9일 연속, 10·11 결석, 12~14 출석
    expect(computeSeatReward([...range(1, 9), 12, 13, 14]).total).toBe(510);
  });

  test("12일 완주인데 7연속이 없으면 460", () => {
    // 5일차·10일차 결석 → 4·4·4 연속
    const r = computeSeatReward([1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14]);
    expect(r.streak).toBe(0);
    expect(r.total).toBe(460);
  });

  test("진행 중(완주 전)에는 완주·개근 보너스가 붙지 않는다", () => {
    const r = computeSeatReward(range(1, 7));
    expect(r).toMatchObject({ install: 100, attendance: 140, streak: 50, completion: 0, perfect: 0 });
    expect(r.total).toBe(290);
  });

  test("체크인이 없으면 0", () => {
    expect(computeSeatReward([]).total).toBe(0);
  });
});

describe("paidSeatVerdict", () => {
  test("3일차까지 체크인이 한 번도 없으면 해제", () => {
    expect(paidSeatVerdict(2, 0, 0)).toBe("ok");
    expect(paidSeatVerdict(3, 0, 0)).toBe("fail");
  });
  test("결석 2일까지는 진행, 3일이면 실패", () => {
    expect(paidSeatVerdict(5, 2, 4)).toBe("ok");
    expect(paidSeatVerdict(5, 1, 1)).toBe("fail");
  });
  test("오늘 체크인은 경과일에 포함하지 않는다", () => {
    expect(paidSeatVerdict(4, 2, 4)).toBe("ok");
  });
  test("14일차 체크인 시 12일 이상이면 완주", () => {
    expect(paidSeatVerdict(14, 12, 14)).toBe("complete");
    expect(paidSeatVerdict(14, 12, 13)).toBe("ok");
  });
  test("기간 종료 후 12일 이상 완주, 11일 이하 실패", () => {
    expect(paidSeatVerdict(0, 12, 13)).toBe("complete");
    expect(paidSeatVerdict(0, 11, 14)).toBe("fail");
  });
});
