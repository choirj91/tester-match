import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  COST_FREE_PENALTY,
  COST_PAID_COMPLETE,
  COST_PAID_DROP,
  judgeMatch,
  type SweepCheckin,
} from "./penalty-judge";

const OPTED_IN = "2026-10-01T03:00:00Z";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 옵트인 후 n일차의 한가운데(12시간 지점)로 현재 시각을 맞춘다 */
function setDay(n: number): void {
  vi.setSystemTime(new Date(new Date(OPTED_IN).getTime() + (n - 1) * DAY_MS + 12 * HOUR_MS));
}

const days = (list: number[], screenshot = true): SweepCheckin[] =>
  list.map((day_n) => ({ day_n, screenshot_url: screenshot ? `shots/${day_n}.png` : null }));

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("judgeMatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("품앗이(무료) 매칭", () => {
    test("스크린샷이 없어도 체크인으로 센다", () => {
      setDay(6);
      const result = judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: false, checkins: days(range(1, 4), false) });
      expect(result).toEqual({ verdict: "ok", cost: COST_FREE_PENALTY, distinctCount: 4 });
    });

    test("5일 연속 미체크인이면 페널티", () => {
      setDay(11);
      const result = judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: false, checkins: days(range(1, 6), false) });
      expect(result.verdict).toBe("fail");
    });
  });

  describe("유료 시트", () => {
    test("기간이 끝났고 증빙 12일이면 완주", () => {
      setDay(15);
      const result = judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: true, checkins: days(range(1, 12)) });
      expect(result).toEqual({ verdict: "complete", cost: COST_PAID_COMPLETE, distinctCount: 12 });
    });

    test("체크인 12행 중 스크린샷이 11일뿐이면 완주가 아니다", () => {
      setDay(15);
      const checkins = [...days(range(1, 11)), ...days([12], false)];
      const result = judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: true, checkins });
      expect(result).toEqual({ verdict: "fail", cost: COST_PAID_DROP, distinctCount: 11 });
    });

    test("3일차까지 증빙 체크인이 없으면 해제 (무참여)", () => {
      setDay(3);
      const result = judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: true, checkins: days([1], false) });
      expect(result).toEqual({ verdict: "fail", cost: COST_PAID_DROP, distinctCount: 0 });
    });

    test("결석 2일까지는 유지, 3일이면 해제", () => {
      setDay(6);
      // 5일 경과 중 3일 출석 = 결석 2일
      expect(judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: true, checkins: days([1, 2, 3]) }).verdict).toBe("ok");
      // 5일 경과 중 2일 출석 = 결석 3일
      expect(judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: true, checkins: days([1, 2]) }).verdict).toBe("fail");
    });

    test("같은 날 중복 행은 하루로 센다", () => {
      setDay(2);
      const result = judgeMatch({ optedInAt: OPTED_IN, isPaidSeat: true, checkins: days([1, 1]) });
      expect(result.distinctCount).toBe(1);
      expect(result.verdict).toBe("ok");
    });
  });

  describe("일차 경계 (서버 타임존과 무관 — 옵트인 시각 기준 24시간 단위)", () => {
    const KST_LATE_NIGHT = "2026-10-01T14:59:00Z"; // KST 10-01 23:59

    test("KST 자정을 넘겨도 24시간이 지나기 전에는 1일차", () => {
      vi.setSystemTime(new Date("2026-10-01T15:01:00Z")); // KST 10-02 00:01
      const result = judgeMatch({ optedInAt: KST_LATE_NIGHT, isPaidSeat: true, checkins: [] });
      expect(result.verdict).toBe("ok");
    });

    test("정확히 48시간이 지나면 3일차 — 증빙이 없으면 해제", () => {
      vi.setSystemTime(new Date("2026-10-03T14:58:59Z")); // 47시간 59분 59초
      expect(judgeMatch({ optedInAt: KST_LATE_NIGHT, isPaidSeat: true, checkins: [] }).verdict).toBe("ok");
      vi.setSystemTime(new Date("2026-10-03T14:59:00Z")); // 48시간
      expect(judgeMatch({ optedInAt: KST_LATE_NIGHT, isPaidSeat: true, checkins: [] }).verdict).toBe("fail");
    });

    test("14일(336시간) 경계: 직전엔 진행 중, 지나면 증빙 일수로 완주 판정", () => {
      const start = new Date(KST_LATE_NIGHT).getTime();
      const checkins = days(range(1, 12));
      vi.setSystemTime(new Date(start + 14 * DAY_MS - 1000));
      // 14일차에 오늘 체크인이 없고 결석 2일(13·14일차 제외 전) → 아직 진행 중
      expect(judgeMatch({ optedInAt: KST_LATE_NIGHT, isPaidSeat: true, checkins }).verdict).toBe("ok");
      vi.setSystemTime(new Date(start + 14 * DAY_MS));
      expect(judgeMatch({ optedInAt: KST_LATE_NIGHT, isPaidSeat: true, checkins }).verdict).toBe("complete");
    });
  });
});
