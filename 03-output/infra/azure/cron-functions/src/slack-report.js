/**
 * 정기 작업 결과를 Slack 운영 채널로 보낸다 (2026-10-07 운영자 요청 — 모든 크론 결과를 Slack 으로).
 * 앱 응답 본문은 숫자·참거짓·배열 길이만 옮긴다 — 경보 문장 등 문자열에는 앱 이름(사용자 입력)이 섞일 수 있다.
 * 보고 실패는 작업 결과를 바꾸지 않는다: 로그만 남기고 넘어간다. 웹훅 주소는 로그에 남기지 않는다.
 *
 * 앱 설정: SLACK_OPS_WEBHOOK_URL (Key Vault 참조). 비어 있으면 보내지 않는다.
 *          CRON_SLACK_MODE = all(기본) | failures — 실패한 실행만 받으려면 failures.
 */

const SLACK_HOST = "hooks.slack.com";
const SLACK_TIMEOUT_MS = 5_000;
const SUMMARY_MAX = 300;
const MESSAGE_MAX = 120;

export function isSlackWebhookUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === SLACK_HOST && url.pathname.startsWith("/services/");
  } catch {
    return false;
  }
}

function escapeSlack(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 회차 합 요약(cron-client mergeTotals) — `key=값` 나열. 배열은 `N건`. */
export function summarizeTotals(totals = {}) {
  const text = Object.entries(totals)
    .map(([key, t]) => `${key}=${t.value}${t.type === "count" ? "건" : ""}`)
    .join(" ");
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX)}…` : text;
}

/** 실패한 응답의 오류 메시지만 — 다른 문자열(경보 문장 등)은 옮기지 않는다 */
export function errorMessage(body) {
  try {
    const parsed = JSON.parse(body);
    const message = parsed && typeof parsed === "object" ? parsed.message : undefined;
    return typeof message === "string" ? escapeSlack(message.slice(0, MESSAGE_MAX)) : "";
  } catch {
    return "";
  }
}

/**
 * 한 번의 작업 실행을 한 줄로 — "✅ penalty-sweep · 4.2초 · 3회 호출 · penalized=5"
 * @param {{ name: string, durationMs: number, steps: Array<{ label?: string, ok: boolean, rounds: number, lastStatus: number, lastBody?: string, totals?: object }> }} run
 */
export function formatCronRun({ name, durationMs, steps }) {
  const ok = steps.every((s) => s.ok);
  const seconds = (durationMs / 1000).toFixed(1);
  const parts = steps.map((s) => {
    const head = s.label ? `${s.label}: ` : "";
    const status = s.ok
      ? `${s.rounds}회 호출`
      : s.lastStatus
        ? `HTTP ${s.lastStatus} (${s.rounds}회째)`
        : `요청 실패 (${s.rounds}회째)`;
    const summary = summarizeTotals(s.totals);
    const message = s.ok ? "" : errorMessage(s.lastBody ?? "");
    return `${head}${status}${summary ? ` · ${summary}` : ""}${message ? ` · message=${message}` : ""}`;
  });
  return `${ok ? "✅" : "❌"} ${name} · ${seconds}초 · ${parts.join(" / ")}`;
}

export function shouldReport(mode, ok) {
  return mode === "failures" ? !ok : true;
}

/**
 * @param {{ webhookUrl?: string, mode?: string, run: Parameters<typeof formatCronRun>[0],
 *           fetchImpl?: typeof fetch, log?: (msg: string) => void }} opts
 * @returns {Promise<"sent" | "skipped" | "failed">}
 */
export async function reportCronRun({ webhookUrl, mode, run, fetchImpl = fetch, log = () => {} }) {
  const ok = run.steps.every((s) => s.ok);
  if (!shouldReport(mode, ok)) return "skipped";
  if (!webhookUrl) {
    log(`${run.name}: Slack report skipped (SLACK_OPS_WEBHOOK_URL is not set)`);
    return "skipped";
  }
  if (!isSlackWebhookUrl(webhookUrl)) {
    log(`${run.name}: Slack report skipped (webhook is not a hooks.slack.com address)`);
    return "skipped";
  }
  try {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: formatCronRun(run) }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (!res.ok) {
      log(`${run.name}: Slack report HTTP ${res.status}`);
      return "failed";
    }
    return "sent";
  } catch (err) {
    // 오류 메시지에 요청 URL 이 들어갈 수 있어 이름만 남긴다
    log(`${run.name}: Slack report failed (${err instanceof Error ? err.name : "unknown"})`);
    return "failed";
  }
}
