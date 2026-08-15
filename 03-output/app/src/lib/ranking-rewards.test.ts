import { describe, expect, it } from "vitest";
import {
  kstMonthRange,
  pickWinners,
  REWARD_TABLE,
  type MonthlyCompletion,
} from "./ranking-rewards";

function row(partial: Partial<MonthlyCompletion> & { userId: number }): MonthlyCompletion {
  return {
    nickname: `u${partial.userId}`,
    trustScore: 50,
    completed: 1,
    lastCompletedAt: "2026-09-10T00:00:00.000Z",
    ...partial,
  };
}

describe("kstMonthRange", () => {
  it("KST 9월은 UTC 로 8/31 15:00 ~ 9/30 15:00", () => {
    const { fromIso, toIso } = kstMonthRange("2026-09-01");
    expect(fromIso).toBe("2026-08-31T15:00:00.000Z");
    expect(toIso).toBe("2026-09-30T15:00:00.000Z");
  });

  it("12월 → 다음 해 1월로 넘어간다", () => {
    const { toIso } = kstMonthRange("2026-12-01");
    expect(toIso).toBe("2026-12-31T15:00:00.000Z");
  });
});

describe("pickWinners", () => {
  it("정상 케이스 — 1·2·3위에 3000/2000/1000", () => {
    const winners = pickWinners([
      row({ userId: 1, completed: 3 }),
      row({ userId: 2, completed: 2 }),
      row({ userId: 3, completed: 1 }),
      row({ userId: 4, completed: 1 }),
    ]);
    expect(winners.map((w) => [w.userId, w.rank, w.amount])).toEqual([
      [1, 1, 3000],
      [2, 2, 2000],
      [3, 3, 1000],
    ]);
  });

  it("1위 요건(완주 2) 미달이면 1위 공석 — 최상위자는 2위 보상", () => {
    const winners = pickWinners([
      row({ userId: 1, completed: 1 }),
      row({ userId: 2, completed: 1 }),
    ]);
    expect(winners.map((w) => [w.userId, w.rank, w.amount])).toEqual([
      [1, 2, 2000],
      [2, 3, 1000],
    ]);
  });

  it("후보 없으면 빈 배열", () => {
    expect(pickWinners([])).toEqual([]);
  });

  it("월 예산 상한 = 보상 테이블 합계를 넘지 않는다", () => {
    const winners = pickWinners([
      row({ userId: 1, completed: 5 }),
      row({ userId: 2, completed: 4 }),
      row({ userId: 3, completed: 3 }),
      row({ userId: 4, completed: 2 }),
    ]);
    const total = winners.reduce((s, w) => s + w.amount, 0);
    expect(total).toBe(REWARD_TABLE[0] + REWARD_TABLE[1] + REWARD_TABLE[2]);
    expect(winners).toHaveLength(3);
  });
});
