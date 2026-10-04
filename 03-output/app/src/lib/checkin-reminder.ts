/**
 * 일일 체크인 리마인더의 판정·문구 — 순수 함수 (현재 시각 외 입력 없음, 단위 테스트 대상).
 * 일차는 옵트인 시각 기준 24시간 단위(lib/checkin.ts)라 서버 타임존과 무관하다.
 * 유료 시트는 스크린샷 증빙이 있는 날만 출석으로 센다 (보상·완주 판정과 같은 기준).
 */

import { currentDayN } from "@/lib/checkin";
import {
  NO_SHOW_RELEASE_DAY,
  SEAT_GRACE_MISSES,
  SEAT_STREAK_DAYS,
  computeSeatReward,
  longestStreak,
} from "@/lib/seat-reward-rules";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ReminderCheckin = { day_n: number; screenshot_url: string | null };

export type PaidSeatNudge = {
  /** 스크린샷 증빙이 있는 출석 일수 (오늘 제외) */
  attended: number;
  /** 지난 날 중 결석 일수 (오늘 제외) */
  missed: number;
  /** 오늘도 놓치면 시트가 해제되는지 */
  lastChance: boolean;
  /** 어제까지 이어진 연속 출석 일수 */
  currentStreak: number;
  /** 오늘 체크인하면 7일 연속 보너스를 받는지 */
  streakBonusToday: boolean;
  /** 지금까지 쌓인 적립 예정 크레딧 (완주 후 지급) */
  earnedSoFar: number;
  /** 오늘 체크인하면 추가로 쌓이는 크레딧 */
  gainToday: number;
};

export type ReminderItem = {
  appId: number;
  name: string;
  dayN: number;
  /** 오늘 체크인 마감까지 남은 시간 (시간 단위, 올림) */
  hoursLeft: number;
  paidSeat: PaidSeatNudge | null;
};

function paidSeatNudge(dayN: number, attendedDays: number[]): PaidSeatNudge {
  const attended = attendedDays.length;
  const missed = Math.max(0, dayN - 1 - attended);
  const days = new Set(attendedDays);
  let currentStreak = 0;
  for (let d = dayN - 1; d >= 1 && days.has(d); d--) currentStreak++;

  const earnedSoFar = computeSeatReward(attendedDays).total;
  const gainToday = computeSeatReward([...attendedDays, dayN]).total - earnedSoFar;
  return {
    attended,
    missed,
    // 결석이 유예(2일)를 넘으면 해제. 첫 체크인이 3일차까지 없어도 해제
    lastChance: missed >= SEAT_GRACE_MISSES || (attended === 0 && dayN >= NO_SHOW_RELEASE_DAY),
    currentStreak,
    streakBonusToday:
      longestStreak(attendedDays) < SEAT_STREAK_DAYS && currentStreak + 1 >= SEAT_STREAK_DAYS,
    earnedSoFar,
    gainToday,
  };
}

/** 오늘 체크인이 아직 없는 진행 중 매칭이면 리마인더 항목, 아니면 null */
export function buildReminderItem(args: {
  appId: number;
  name: string;
  optedInAt: string;
  isPaidSeat: boolean;
  checkins: ReminderCheckin[];
}): ReminderItem | null {
  const dayN = currentDayN(args.optedInAt);
  if (dayN === 0) return null; // 기간 종료 또는 시작 전

  const counted = args.isPaidSeat ? args.checkins.filter((c) => c.screenshot_url) : args.checkins;
  const days = [...new Set(counted.map((c) => c.day_n))];
  if (days.includes(dayN)) return null; // 오늘 이미 체크인

  const paidSeat = args.isPaidSeat
    ? paidSeatNudge(
        dayN,
        days.filter((d) => d >= 1 && d < dayN),
      )
    : null;
  // 이미 결석이 유예를 넘은 시트는 오늘 체크인해도 해제된다 — 헛된 독촉을 보내지 않는다 (해제 알림은 스윕이 보낸다)
  if (paidSeat && paidSeat.missed > SEAT_GRACE_MISSES) return null;

  const dayEndsAt = new Date(args.optedInAt).getTime() + dayN * DAY_MS;
  return {
    appId: args.appId,
    name: args.name,
    dayN,
    hoursLeft: Math.max(1, Math.ceil((dayEndsAt - Date.now()) / HOUR_MS)),
    paidSeat,
  };
}

/** 유료 시트 항목의 안내 문장들 (메일·사이트 알림 공용) */
export function paidSeatNudgeLines(item: ReminderItem): string[] {
  const seat = item.paidSeat;
  if (!seat) return [];
  const lines: string[] = [];

  // 첫 체크인이 없는 시트는 하루가 끝날 때가 아니라 그날 시트 정리(페널티 스윕) 시점에 해제된다
  const noShowToday = seat.attended === 0 && seat.lastChance;
  if (seat.attended === 0) {
    lines.push(
      noShowToday
        ? "아직 첫 체크인이 없습니다. 오늘 시트 정리 때 해제되니 지금 바로 체크인해주세요."
        : `아직 첫 체크인이 없습니다. ${NO_SHOW_RELEASE_DAY}일차 시트 정리 전까지 없으면 해제되니 오늘 해두세요.`,
    );
  } else if (seat.lastChance) {
    lines.push(
      `결석 ${seat.missed}일 — 오늘 체크인하지 않으면 시트가 해제되고 적립 예정 ${seat.earnedSoFar.toLocaleString("ko-KR")} 크레딧이 사라집니다.`,
    );
  } else if (seat.missed > 0) {
    lines.push(`결석 ${seat.missed}일 — ${SEAT_GRACE_MISSES + 1}일이 되면 시트가 해제됩니다.`);
  } else {
    lines.push(`${seat.attended}일 개근 중입니다.`);
  }

  const bonus =
    seat.attended === 0
      ? " (설치 인증 포함)"
      : seat.streakBonusToday
        ? ` (${SEAT_STREAK_DAYS}일 연속 보너스 포함)`
        : "";
  // 크레딧은 완주 후에야 지급된다 — 오늘 받는 것처럼 읽히지 않게 "적립 예정"과 "완주 후 지급"을 같은 문장에 둔다
  lines.push(
    `오늘 스크린샷과 함께 체크인하면 적립 예정 +${seat.gainToday.toLocaleString("ko-KR")} 크레딧${bonus} — 완주 후 지급.`,
  );

  if (seat.attended > 0 && !seat.lastChance) {
    lines.push(
      `지금까지 적립 예정 ${seat.earnedSoFar.toLocaleString("ko-KR")} 크레딧 · 연속 ${seat.currentStreak}일.`,
    );
  }
  if (!noShowToday) lines.push(`오늘 체크인 마감까지 약 ${item.hoursLeft}시간.`);
  return lines;
}

/** 유료 시트를 앞에, 그 안에서는 급한 것(마지막 기회 → 남은 시간 짧은 순)을 앞에 */
export function sortReminderItems(items: ReminderItem[]): ReminderItem[] {
  const rank = (i: ReminderItem): number => (i.paidSeat ? (i.paidSeat.lastChance ? 0 : 1) : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || a.hoursLeft - b.hoursLeft);
}
