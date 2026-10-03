/**
 * 유료 시트 규칙 — 순수 상수·함수만 (서버·클라이언트 공용, 다른 모듈을 import 하지 않는다).
 * ADR-0012 부록 A(에스크로·12/14 완주)·부록 C(마일스톤 보상).
 */

export const SEAT_TOTAL_DAYS = 14;
export const SEAT_MIN_CHECKIN_DAYS = 12;
export const SEAT_GRACE_MISSES = SEAT_TOTAL_DAYS - SEAT_MIN_CHECKIN_DAYS;
/** 참여 후 이 일차가 되도록 체크인이 한 번도 없으면 시트를 해제한다 (시트 선점 방지) */
export const NO_SHOW_RELEASE_DAY = 3;
export const SEAT_STREAK_DAYS = 7;

export const SEAT_REWARD_HOLD_DAYS = 3;
export const DISPUTE_REASON_MIN = 10;
/** 이의 제기 후 관리자가 이 일수 안에 판정하지 않으면 테스터에게 자동 지급 */
export const DISPUTE_DECISION_DAYS = 7;

/**
 * 마일스톤 보상 (크레딧). 완주해야 지급되며, 완주 시 보류 → 구매자 확정/3일 자동 확정.
 * 출시 보너스는 등록자가 앱을 "출시 완료"로 바꾼 뒤 별도 지급.
 */
export const SEAT_REWARDS = {
  /** 설치 인증 — 첫 스크린샷 체크인 */
  install: 100,
  /** 출석 1일당 */
  daily: 20,
  /** 7일 연속 출석 달성 (1회) */
  streak: 50,
  /** 완주 — 12일 이상 출석 */
  completion: 120,
  /** 개근 — 14일 전부 출석 */
  perfect: 50,
  /** 앱 정식 출시 */
  launch: 100,
} as const;

/** 완주 시점에 받을 수 있는 최대 (개근) */
export const SEAT_REWARD_MAX_AT_COMPLETION =
  SEAT_REWARDS.install +
  SEAT_REWARDS.daily * SEAT_TOTAL_DAYS +
  SEAT_REWARDS.streak +
  SEAT_REWARDS.completion +
  SEAT_REWARDS.perfect;
/** 출시 보너스까지 포함한 시트당 최대 */
export const SEAT_REWARD_MAX = SEAT_REWARD_MAX_AT_COMPLETION + SEAT_REWARDS.launch;

export type SeatRewardBreakdown = {
  days: number;
  longestStreak: number;
  install: number;
  attendance: number;
  streak: number;
  completion: number;
  perfect: number;
  total: number;
};

function validDays(dayNumbers: ReadonlyArray<number>): number[] {
  return [...new Set(dayNumbers)]
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= SEAT_TOTAL_DAYS)
    .sort((a, b) => a - b);
}

/** 가장 긴 연속 출석 일수 */
export function longestStreak(dayNumbers: ReadonlyArray<number>): number {
  let best = 0;
  let run = 0;
  let prev = -1;
  for (const d of validDays(dayNumbers)) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/**
 * 체크인한 일차 목록으로 보상을 산정한다. 완주(12일↑) 전에는 completion·perfect 가 0 이므로
 * 진행 중 "적립 예정" 표시에도 그대로 쓸 수 있다.
 */
export function computeSeatReward(dayNumbers: ReadonlyArray<number>): SeatRewardBreakdown {
  const days = validDays(dayNumbers).length;
  const streakLen = longestStreak(dayNumbers);
  const install = days >= 1 ? SEAT_REWARDS.install : 0;
  const attendance = days * SEAT_REWARDS.daily;
  const streak = streakLen >= SEAT_STREAK_DAYS ? SEAT_REWARDS.streak : 0;
  const completion = days >= SEAT_MIN_CHECKIN_DAYS ? SEAT_REWARDS.completion : 0;
  const perfect = days === SEAT_TOTAL_DAYS ? SEAT_REWARDS.perfect : 0;
  return {
    days,
    longestStreak: streakLen,
    install,
    attendance,
    streak,
    completion,
    perfect,
    total: install + attendance + streak + completion + perfect,
  };
}

export type SeatVerdict = "ok" | "complete" | "fail";

/**
 * 유료 시트 진행 판정.
 * @param currentDay currentDayN 결과 (1~14, 기간 종료 후 0)
 * @param checkinDays 체크인된 일수
 * @param lastCheckinDay 마지막 체크인의 day_n (없으면 0)
 */
export function paidSeatVerdict(
  currentDay: number,
  checkinDays: number,
  lastCheckinDay: number,
): SeatVerdict {
  if (currentDay === 0) {
    return checkinDays >= SEAT_MIN_CHECKIN_DAYS ? "complete" : "fail";
  }
  if (checkinDays === 0 && currentDay >= NO_SHOW_RELEASE_DAY) return "fail";
  const checkedToday = lastCheckinDay === currentDay;
  const missed = currentDay - 1 - (checkinDays - (checkedToday ? 1 : 0));
  if (missed > SEAT_GRACE_MISSES) return "fail";
  if (currentDay === SEAT_TOTAL_DAYS && checkedToday && checkinDays >= SEAT_MIN_CHECKIN_DAYS) {
    return "complete";
  }
  return "ok";
}

export type SeatRewardStatus = "held" | "released" | "disputed" | "forfeited";

export const SEAT_REWARD_STATUS_LABEL: Record<SeatRewardStatus, string> = {
  held: "확정 대기",
  released: "지급 완료",
  disputed: "이의 검토 중",
  forfeited: "미지급 (몰수)",
};

/** 이의는 스크린샷 증빙으로 확인 가능한 사유만 받는다 */
export const DISPUTE_CATEGORIES = {
  not_my_app: "내 앱 화면이 아닌 스크린샷",
  duplicate: "같은 화면을 반복·재사용한 스크린샷",
  prohibited: "금지 행위 (리뷰 작성, 에뮬레이터, 다중 계정 등)",
} as const;
export type DisputeCategory = keyof typeof DISPUTE_CATEGORIES;

/** 보상 규칙 한 줄 요약 (알림·공지·안내 공용) */
export const SEAT_REWARD_SUMMARY = `설치 인증 ${SEAT_REWARDS.install} · 출석 ${SEAT_REWARDS.daily}/일 · 7일 연속 +${SEAT_REWARDS.streak} · 완주(${SEAT_MIN_CHECKIN_DAYS}일↑) +${SEAT_REWARDS.completion} · 개근 +${SEAT_REWARDS.perfect} · 앱 출시 +${SEAT_REWARDS.launch} (최대 ${SEAT_REWARD_MAX})`;
