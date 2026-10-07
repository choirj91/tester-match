/**
 * Slack 수신 웹훅(Incoming Webhook) 전송 — edge runtime 호환 (fetch 직접 호출).
 * 웹훅 URL 은 비밀값이다: 환경변수로만 받고 로그·응답에 절대 남기지 않는다.
 * 전송 실패는 호출부의 본 작업(문의 접수)을 막지 않는다 — 결과만 돌려준다.
 */

import { SITE_URL } from "@/lib/site";

const SLACK_WEBHOOK_HOST = "hooks.slack.com";
const SLACK_TIMEOUT_MS = 5000;
const EXCERPT_MAX = 300;

export type SlackPayload = { text: string; blocks?: unknown[] };

export type SlackResult =
  | { ok: true }
  | { ok: false; reason: "no_webhook" | "invalid_webhook" | "http_error" | "exception"; detail?: string };

/** Slack mrkdwn 제어 문자 이스케이프 — 사용자 글이 링크·멘션(<!channel> 등)으로 해석되지 않게 한다 */
export function escapeSlackText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Slack 수신 웹훅 주소인지 — 잘못 설정된 값으로 엉뚱한 서버에 문의 내용을 보내지 않기 위한 확인 */
export function isSlackWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === SLACK_WEBHOOK_HOST &&
      url.pathname.startsWith("/services/")
    );
  } catch {
    return false;
  }
}

export async function postSlackMessage(
  webhookUrl: string | undefined,
  payload: SlackPayload,
): Promise<SlackResult> {
  if (!webhookUrl) {
    console.warn("[slack] webhook URL is not set — message not sent");
    return { ok: false, reason: "no_webhook" };
  }
  if (!isSlackWebhookUrl(webhookUrl)) {
    console.error("[slack] webhook URL is not a hooks.slack.com address — message not sent");
    return { ok: false, reason: "invalid_webhook" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[slack] HTTP", res.status);
      return { ok: false, reason: "http_error", detail: `${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    // 오류 객체에 요청 URL 이 들어 있을 수 있어 메시지 이름만 남긴다
    console.error("[slack] request failed", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "exception" };
  } finally {
    clearTimeout(timer);
  }
}

function excerpt(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_MAX ? `${flat.slice(0, EXCERPT_MAX)}…` : flat;
}

/**
 * 새 문의 알림 메시지. 이메일 등 연락처는 넣지 않는다 — 닉네임·분류·제목·본문 앞부분과 관리자 페이지 링크만.
 */
export function inquirySlackPayload(args: {
  id: number;
  categoryLabel: string;
  title: string;
  body: string;
  nickname: string;
  userId: number;
}): SlackPayload {
  const title = escapeSlackText(args.title);
  const category = escapeSlackText(args.categoryLabel);
  const adminUrl = `${SITE_URL}/admin/inquiries/${args.id}`;
  return {
    text: `새 문의 #${args.id} [${category}] ${title}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*새 문의 #${args.id}* · ${category}\n*${title}*` },
      },
      { type: "section", text: { type: "mrkdwn", text: escapeSlackText(excerpt(args.body)) } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `작성자 ${escapeSlackText(args.nickname)} (회원 #${args.userId}) · <${adminUrl}|관리자 페이지에서 처리>`,
          },
        ],
      },
    ],
  };
}

/**
 * 운영 알림(일일 리포트 등) 채널 웹훅. 따로 정하지 않았으면 문의 알림 채널로 보낸다 —
 * 웹훅을 새로 만들지 않아도 바로 받도록. 채널을 나누려면 SLACK_OPS_WEBHOOK_URL 만 넣으면 된다.
 */
export function opsSlackWebhookUrl(): string | undefined {
  return process.env.SLACK_OPS_WEBHOOK_URL || process.env.SLACK_INQUIRY_WEBHOOK_URL || undefined;
}

const REPORT_ALERTS_MAX = 20;
/** 경보 한 줄 상한 — 운영 메모가 길게 붙은 경보가 메시지 전체를 막지 않게 */
const REPORT_ALERT_CHARS = 200;
/** 섹션 하나에 넣는 경보 수 — Slack 섹션 텍스트는 3,000자까지 (10 × 200 < 3,000) */
const REPORT_ALERTS_PER_SECTION = 10;

/** 일일 관리자 리포트 요약 — 메일과 같은 숫자·경보. 경보 문장에는 앱 이름(사용자 입력)이 섞여 있어 이스케이프한다. */
export function dailyReportSlackPayload(args: {
  dateLabel: string;
  activeOrders: number;
  autoCanceledCount: number;
  yearlyPaidCount: number;
  alerts: ReadonlyArray<string>;
}): SlackPayload {
  const headline =
    args.alerts.length > 0
      ? `일일 리포트 ${args.dateLabel} — 확인 필요 ${args.alerts.length}건`
      : `일일 리포트 ${args.dateLabel} — 이상 없음`;
  const stats = `진행 중 주문 ${args.activeOrders}건 · 24시간 자동 취소 ${args.autoCanceledCount}건 · 올해 결제 ${args.yearlyPaidCount}건`;
  // 이스케이프하면 길이가 늘어난다(< → &lt;) — 이스케이프한 뒤 자르고, 잘린 엔티티 조각은 버린다
  const clip = (text: string) =>
    text.length > REPORT_ALERT_CHARS
      ? `${text.slice(0, REPORT_ALERT_CHARS).replace(/&[a-z]{0,3}$/, "")}…`
      : text;
  const shown = args.alerts.slice(0, REPORT_ALERTS_MAX).map((a) => `• ${clip(escapeSlackText(a))}`);
  const more =
    args.alerts.length > REPORT_ALERTS_MAX ? [`… 외 ${args.alerts.length - REPORT_ALERTS_MAX}건`] : [];
  const lines = [...shown, ...more];
  const alertSections = [];
  for (let i = 0; i < lines.length; i += REPORT_ALERTS_PER_SECTION) {
    alertSections.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.slice(i, i + REPORT_ALERTS_PER_SECTION).join("\n") },
    });
  }
  return {
    text: `${args.alerts.length > 0 ? "⚠️" : "✅"} ${headline}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${headline}*\n${stats}` } },
      ...alertSections,
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `<${SITE_URL}/admin/paid-orders|주문 관리>` }],
      },
    ],
  };
}
