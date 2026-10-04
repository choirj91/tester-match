import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildReminderItem,
  paidSeatNudgeLines,
  sortReminderItems,
  type ReminderCheckin,
} from "./checkin-reminder";
import { dailyCheckinReminderEmail } from "./email-templates";
import { paidSeatVerdict } from "./seat-reward-rules";

const OPTED_IN = "2026-10-01T03:00:00Z";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 옵트인 후 n일차가 시작된 지 hoursIn 시간 지난 시점으로 현재 시각을 맞춘다 */
function setDay(n: number, hoursIn = 12): void {
  vi.setSystemTime(new Date(new Date(OPTED_IN).getTime() + (n - 1) * DAY_MS + hoursIn * HOUR_MS));
}

const days = (list: number[], screenshot = true): ReminderCheckin[] =>
  list.map((day_n) => ({ day_n, screenshot_url: screenshot ? `shots/${day_n}.png` : null }));

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const item = (isPaidSeat: boolean, checkins: ReminderCheckin[]) =>
  buildReminderItem({ appId: 7, name: "가계부", optedInAt: OPTED_IN, isPaidSeat, checkins });

describe("buildReminderItem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("오늘 이미 체크인했으면 리마인더 대상이 아니다", () => {
    setDay(3);
    expect(item(false, days([1, 2, 3], false))).toBeNull();
    expect(item(true, days([1, 2, 3]))).toBeNull();
  });

  test("기간이 끝난 매칭은 대상이 아니다", () => {
    setDay(15);
    expect(item(true, days(range(1, 12)))).toBeNull();
  });

  test("품앗이 매칭은 스크린샷 없이도 체크인으로 보고, 유료 시트 정보는 없다", () => {
    setDay(3);
    const result = item(false, days([1, 2], false));
    expect(result).toMatchObject({ appId: 7, name: "가계부", dayN: 3, paidSeat: null });
  });

  test("유료 시트는 스크린샷 없는 오늘 체크인을 미완료로 본다", () => {
    setDay(3);
    const result = item(true, [...days([1, 2]), ...days([3], false)]);
    expect(result?.paidSeat).toMatchObject({ attended: 2, missed: 0 });
  });

  test("마감까지 남은 시간은 옵트인 시각 기준 24시간 창으로 계산한다", () => {
    setDay(2, 21); // 2일차 시작 후 21시간 → 3시간 남음
    expect(item(true, days([1]))?.hoursLeft).toBe(3);
    setDay(2, 23.5); // 30분 남음 → 올림 1시간
    expect(item(true, days([1]))?.hoursLeft).toBe(1);
  });

  test("KST 자정을 넘겨도 24시간이 지나기 전에는 같은 일차다", () => {
    const lateNight = "2026-10-01T14:59:00Z"; // KST 23:59
    vi.setSystemTime(new Date("2026-10-01T15:01:00Z")); // KST 다음 날 00:01
    const result = buildReminderItem({
      appId: 1,
      name: "앱",
      optedInAt: lateNight,
      isPaidSeat: true,
      checkins: [],
    });
    expect(result?.dayN).toBe(1);
    expect(result?.hoursLeft).toBe(24);
  });

  describe("유료 시트 안내", () => {
    test("첫 체크인 전: 오늘 하면 설치 인증 100 + 출석 20", () => {
      setDay(1);
      const seat = item(true, [])?.paidSeat;
      expect(seat).toMatchObject({ attended: 0, missed: 0, lastChance: false, earnedSoFar: 0, gainToday: 120 });
    });

    test("3일차까지 첫 체크인이 없으면 마지막 기회", () => {
      setDay(3);
      expect(item(true, [])?.paidSeat?.lastChance).toBe(true);
    });

    test("결석 1일은 경고, 결석 2일이면 오늘이 마지막 기회", () => {
      setDay(5);
      expect(item(true, days([1, 2, 3]))?.paidSeat).toMatchObject({ missed: 1, lastChance: false });
      expect(item(true, days([1, 2]))?.paidSeat).toMatchObject({ missed: 2, lastChance: true });
    });

    test("6일 연속 뒤 오늘 체크인하면 7일 연속 보너스 +50 이 붙는다", () => {
      setDay(7);
      const seat = item(true, days(range(1, 6)))?.paidSeat;
      expect(seat).toMatchObject({ currentStreak: 6, streakBonusToday: true, gainToday: 70 });
    });

    test("이미 7일 연속을 달성했으면 보너스를 다시 약속하지 않는다", () => {
      setDay(9);
      const seat = item(true, days(range(1, 8)))?.paidSeat;
      expect(seat).toMatchObject({ currentStreak: 8, streakBonusToday: false, gainToday: 20 });
    });

    test("12번째 출석일에는 완주 보너스 +120 이 붙는다", () => {
      setDay(12);
      const seat = item(true, days(range(1, 11)))?.paidSeat;
      expect(seat?.gainToday).toBe(140);
    });

    test("연속 출석은 어제까지 이어진 구간만 센다", () => {
      setDay(6);
      expect(item(true, days([1, 2, 4, 5]))?.paidSeat).toMatchObject({ currentStreak: 2, missed: 1 });
      expect(item(true, days([1, 2, 3, 4]))?.paidSeat).toMatchObject({ currentStreak: 0, missed: 1 });
    });
  });
});

describe("paidSeatNudgeLines", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("품앗이 매칭에는 문장이 없다", () => {
    setDay(3);
    const result = item(false, days([1], false));
    expect(result && paidSeatNudgeLines(result)).toEqual([]);
  });

  test("마지막 기회면 해제와 사라지는 크레딧을 말한다", () => {
    setDay(5);
    const result = item(true, days([1, 2]));
    const text = result ? paidSeatNudgeLines(result).join(" ") : "";
    expect(text).toContain("결석 2일");
    expect(text).toContain("시트가 해제");
    expect(text).toContain("140 크레딧"); // 설치 100 + 출석 2일 40
  });

  test("개근 중이면 연속 일수와 오늘 얻는 크레딧을 말한다", () => {
    setDay(4, 20);
    const result = item(true, days([1, 2, 3]));
    const lines = result ? paidSeatNudgeLines(result) : [];
    expect(lines[0]).toBe("3일 개근 중입니다.");
    expect(lines[1]).toBe("오늘 스크린샷과 함께 체크인하면 적립 예정 +20 크레딧 — 완주 후 지급.");
    expect(lines.join(" ")).toContain("연속 3일");
    expect(lines.at(-1)).toBe("오늘 체크인 마감까지 약 4시간.");
  });

  test("리뷰·별점을 언급하지 않는다", () => {
    setDay(2);
    const result = item(true, days([1]));
    const text = result ? paidSeatNudgeLines(result).join(" ") : "";
    expect(text).not.toMatch(/리뷰|별점/);
  });
});

describe("sortReminderItems", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("마지막 기회인 유료 시트 → 다른 유료 시트 → 품앗이 순", () => {
    setDay(5);
    const free = item(false, days([1], false));
    const calm = item(true, days([1, 2, 3, 4]));
    const urgent = item(true, days([1, 2]));
    const sorted = sortReminderItems([free, calm, urgent].filter((i) => i !== null));
    expect(sorted.map((i) => (i.paidSeat ? (i.paidSeat.lastChance ? "urgent" : "calm") : "free"))).toEqual([
      "urgent",
      "calm",
      "free",
    ]);
  });
});

describe("스윕 판정과의 일치 (lastChance ⇔ 오늘 체크인하지 않으면 해제)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** 1..dayN-1 중 attendedCount 일을 앞에서부터 출석한 패턴과 뒤에서부터 출석한 패턴 */
  const patterns = (dayN: number, attendedCount: number): number[][] => [
    range(1, attendedCount),
    range(dayN - attendedCount, dayN - 1),
  ];

  test("1~14일차 × 출석 패턴 전수: 리마인더의 마지막 기회 표시가 스윕 판정과 같다", () => {
    for (let dayN = 1; dayN <= 14; dayN++) {
      for (let attendedCount = 0; attendedCount < dayN; attendedCount++) {
        for (const attended of patterns(dayN, attendedCount)) {
          setDay(dayN);
          const result = item(true, days(attended));
          const missed = dayN - 1 - attendedCount;
          if (missed > 2) {
            // 이미 해제 대상 — 리마인더를 보내지 않는다
            expect(result, `day ${dayN} attended [${attended}]`).toBeNull();
            continue;
          }
          const lastDay = attended.length === 0 ? 0 : Math.max(...attended);
          // 오늘 체크인하지 않았을 때: 무참여는 오늘 스윕, 그 외는 다음 날 스윕(14일차는 기간 종료 판정)
          const verdictIfSkipped =
            attendedCount === 0
              ? paidSeatVerdict(dayN, 0, 0)
              : paidSeatVerdict(dayN === 14 ? 0 : dayN + 1, attendedCount, lastDay);
          expect(result?.paidSeat?.lastChance, `day ${dayN} attended [${attended}]`).toBe(
            verdictIfSkipped === "fail",
          );
        }
      }
    }
  });

  test("2일차 무참여는 마지막 기회가 아니지만 오늘 해두라고 안내한다", () => {
    setDay(2);
    const result = item(true, []);
    expect(result?.paidSeat?.lastChance).toBe(false);
    expect(result ? paidSeatNudgeLines(result)[0] : "").toContain("3일차 시트 정리 전까지");
  });

  test("3일차 무참여는 하루 끝 마감 시간을 말하지 않고 지금 바로 하라고 안내한다", () => {
    setDay(3, 2);
    const result = item(true, []);
    const lines = result ? paidSeatNudgeLines(result) : [];
    expect(lines[0]).toContain("지금 바로");
    expect(lines.join(" ")).not.toContain("마감까지");
  });

  test("14일차에 11일 출석이면 마지막 기회이고, 오늘 체크인하면 완주 보너스가 붙는다", () => {
    setDay(14);
    const seat = item(true, days(range(1, 11)))?.paidSeat;
    expect(seat).toMatchObject({ missed: 2, lastChance: true, gainToday: 140 });
  });

  test("빈 문자열 스크린샷은 증빙이 아니다", () => {
    setDay(3);
    const result = item(true, [...days([1]), { day_n: 2, screenshot_url: "" }]);
    expect(result?.paidSeat).toMatchObject({ attended: 1, missed: 1 });
  });
});

describe("dailyCheckinReminderEmail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const build = (name: string, isPaidSeat: boolean, checkins: ReminderCheckin[]) => {
    const result = buildReminderItem({ appId: 1, name, optedInAt: OPTED_IN, isPaidSeat, checkins });
    if (!result) throw new Error("expected a reminder item");
    return result;
  };

  test("마지막 기회인 유료 시트가 있으면 해제 경고 제목", () => {
    setDay(5);
    const mail = dailyCheckinReminderEmail({
      testerNickname: "테스터",
      items: [build("가계부", true, days([1, 2])), build("메모장", false, [])],
    });
    expect(mail.subject).toBe("[Tester Match] ⚠️ 오늘 체크인하지 않으면 유료 시트가 해제됩니다");
  });

  test("급하지 않은 유료 시트는 유료 시트 개수 제목", () => {
    setDay(5);
    const mail = dailyCheckinReminderEmail({
      testerNickname: "테스터",
      items: [build("가계부", true, days([1, 2, 3, 4])), build("메모장", false, [])],
    });
    expect(mail.subject).toBe("[Tester Match] 💰 유료 시트 오늘 체크인이 남았습니다 (1개)");
  });

  test("품앗이만 있으면 기존 제목과 5일 연속 페널티 안내만 나간다", () => {
    setDay(5);
    const mail = dailyCheckinReminderEmail({
      testerNickname: "테스터",
      items: [build("메모장", false, []), build("일정표", false, [])],
    });
    expect(mail.subject).toBe("[Tester Match] 오늘 체크인할 앱 2개");
    expect(mail.text).toContain("5일 연속");
    expect(mail.text).not.toContain("유료 시트");
  });

  test("앱 이름과 닉네임의 HTML 을 이스케이프한다", () => {
    setDay(5);
    const mail = dailyCheckinReminderEmail({
      testerNickname: "<script>alert(1)</script>",
      items: [
        build("<script>x</script>", true, days([1, 2, 3, 4])),
        build("<img src=x onerror=1>", false, []),
      ],
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  test("유료 시트 안내는 완주 후 지급임을 밝히고 리뷰·별점을 언급하지 않는다", () => {
    setDay(5);
    for (const checkins of [[], days([1, 2]), days([1, 2, 3, 4])]) {
      setDay(checkins.length === 0 ? 1 : 5);
      const mail = dailyCheckinReminderEmail({
        testerNickname: "테스터",
        items: [build("가계부", true, checkins)],
      });
      expect(mail.text).toContain("완주 후 지급");
      expect(mail.html).toContain("완주 후 지급");
      expect(mail.text + mail.html + mail.subject).not.toMatch(/리뷰|별점/);
    }
  });
});
