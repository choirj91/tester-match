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
    console.warn("[slack] SLACK_INQUIRY_WEBHOOK_URL is not set — message not sent");
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
