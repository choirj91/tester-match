/**
 * 회원별 크레딧·신뢰도 증가 내역 — 일일·주간 관리자 리포트(메일·Slack)에 싣는다 (2026-10-09 운영자 요청:
 * 비정상 증가를 찾는다). 조회는 DB 함수 member_gain_report (마이그레이션 20261009000001).
 * 회원은 id·닉네임으로만 표시한다 (이메일 없음). 조회 실패는 경보 한 줄로 알린다 — "증가 없음"으로 오해하지 않게.
 * 크레딧은 "크레딧" 단위로만 쓴다 (원·₩ 금지 — ADR-0017), 신뢰도는 "신뢰도 +n".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatKrw } from "@/lib/credits";

export const GAIN_KINDS = ["credit", "trust"] as const;
export type GainKind = (typeof GAIN_KINDS)[number];

export type GainRow = {
  kind: GainKind;
  user_id: number;
  nickname: string | null;
  gained: number;
  /** 더한 원장·이력 행 수 */
  entries: number;
  /** 유형·사유별 합 — "earn 600 · refund 1,100" */
  detail: string;
};

/** 한 종류의 전체 목록 — rows 는 증가량 큰 순, 잘리지 않은 전체 */
export type GainList = { members: number; gained: number; rows: ReadonlyArray<GainRow> };
export type GainLists = { credit: GainList; trust: GainList };
export type GainReport = ({ ok: true } & GainLists) | { ok: false; alert: string };

export type ReportWindow = { since: Date; until: Date };

export const GAIN_REPORT_FAILED_ALERT =
  "회원 크레딧·신뢰도 증가 내역 조회 실패 — 직접 확인이 필요합니다.";
/** Slack 은 종류마다 상위 15명, 메일은 100명 */
export const GAIN_SLACK_MAX = 15;
export const GAIN_MAIL_MAX = 100;
/** PostgREST 응답 행 상한(PGRST_DB_MAX_ROWS=1000) — 넘으면 range 로 이어 읽는다 */
const PAGE_SIZE = 1000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** KST 는 일광 절약 시간이 없다 — 항상 UTC+9 */
const KST_OFFSET_MS = 9 * HOUR_MS;
/** 주간 리포트 경계: 금요일(getUTCDay 5) KST 22:00 = 금요일 UTC 13:00 */
const WEEKLY_BOUNDARY_DAY = 5;
const WEEKLY_BOUNDARY_KST_HOUR = 22;
/** 타이머가 경계 직전에 깨어나도(시계 오차) 그 금요일로 본다 */
const WEEKLY_SCHEDULE_SKEW_MS = 2 * 60 * 1000;

export const GAIN_KIND_LABEL: Readonly<Record<GainKind, string>> = {
  credit: "크레딧 증가",
  trust: "신뢰도 증가",
};

/** 일일 리포트 — 보내는 시각 직전 24시간 [now − 24h, now) */
export function dailyGainWindow(now: Date): ReportWindow {
  return { since: new Date(now.getTime() - DAY_MS), until: now };
}

/**
 * 주간 리포트 — 지난 금요일 KST 22:00 → 이번 금요일 KST 22:00.
 * 끝은 지금(경계 직전 2분 허용) 이전의 가장 최근 금요일 22:00 이다: 22:00 정각·늦게 돈 실행(22:30 등)은
 * 그 금요일, 주중에 손으로 돌리면 지난 금요일까지(마감된 한 주).
 */
export function weeklyReportWindow(now: Date): ReportWindow {
  const ref = new Date(now.getTime() + WEEKLY_SCHEDULE_SKEW_MS + KST_OFFSET_MS); // KST 벽시계를 UTC 필드로
  const daysSinceBoundaryDay = (ref.getUTCDay() - WEEKLY_BOUNDARY_DAY + 7) % 7;
  const boundaryKst =
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), WEEKLY_BOUNDARY_KST_HOUR) -
    daysSinceBoundaryDay * DAY_MS;
  const untilKst = boundaryKst > ref.getTime() ? boundaryKst - WEEK_MS : boundaryKst;
  const until = untilKst - KST_OFFSET_MS;
  return { since: new Date(until - WEEK_MS), until: new Date(until) };
}

function kstLabel(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(kst.getUTCMonth() + 1)}/${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

/** "10/02 22:00 – 10/09 22:00" (KST) */
export function formatWindowLabel(window: ReportWindow): string {
  return `${kstLabel(window.since)} – ${kstLabel(window.until)}`;
}

/** "+1,100 크레딧" · "신뢰도 +14" */
export function formatGain(kind: GainKind, amount: number): string {
  return kind === "credit" ? `+${formatKrw(amount)} 크레딧` : `신뢰도 +${formatKrw(amount)}`;
}

/** "3명 · 합계 2,800 크레딧" · "12명 · 합계 신뢰도 +45" */
export function formatGainSummary(kind: GainKind, list: GainList): string {
  const sum =
    kind === "credit" ? `${formatKrw(list.gained)} 크레딧` : `신뢰도 +${formatKrw(list.gained)}`;
  return `${list.members}명 · 합계 ${sum}`;
}

/**
 * 한 줄 — "#12 닉네임 +1,100 크레딧 (2건: refund 1,100 · earn 600)".
 * escape 는 출력 채널에 맞춰 닉네임(사용자 입력)·내역에 적용한다 (Slack: escapeSlackText).
 */
export function formatGainLine(row: GainRow, escape: (value: string) => string = (v) => v): string {
  const nickname = escape(row.nickname ?? "-");
  const detail = row.detail ? `${row.entries}건: ${escape(row.detail)}` : `${row.entries}건`;
  return `#${row.user_id} ${nickname} ${formatGain(row.kind, row.gained)} (${detail})`;
}

function toList(rows: ReadonlyArray<GainRow>, kind: GainKind): GainList {
  const list = rows
    .filter((r) => r.kind === kind)
    .map((r) => ({
      ...r,
      user_id: Number(r.user_id),
      gained: Number(r.gained),
      entries: Number(r.entries),
      detail: r.detail ?? "",
    }))
    .sort((a, b) => b.gained - a.gained || a.user_id - b.user_id);
  return { members: list.length, gained: list.reduce((sum, r) => sum + r.gained, 0), rows: list };
}

type GainTotals = { members: number; gained: number };
export type GainCounts = { gainsLoaded: boolean; creditGain?: GainTotals; trustGain?: GainTotals };

/** 응답 JSON 용 숫자 요약 — 목록·닉네임은 싣지 않는다 (Functions 가 응답을 Slack 으로 옮긴다) */
export function gainCounts(report: GainReport): GainCounts {
  if (!report.ok) return { gainsLoaded: false };
  return {
    gainsLoaded: true,
    creditGain: { members: report.credit.members, gained: report.credit.gained },
    trustGain: { members: report.trust.members, gained: report.trust.gained },
  };
}

/** 기간 안 증가 내역을 모두 읽는다 (PostgREST 행 상한을 넘으면 이어 읽기). 실패하면 ok:false + 경보 문장. */
export async function loadGainReport(
  supabase: SupabaseClient,
  window: ReportWindow,
): Promise<GainReport> {
  const args = { p_since: window.since.toISOString(), p_until: window.until.toISOString() };
  let rows: GainRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("member_gain_report", args)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[gain-report] member_gain_report failed", error.message);
      return { ok: false, alert: GAIN_REPORT_FAILED_ALERT };
    }
    const page = (data ?? []) as GainRow[];
    rows = [...rows, ...page];
    if (page.length < PAGE_SIZE) break;
  }
  return { ok: true, credit: toList(rows, "credit"), trust: toList(rows, "trust") };
}
