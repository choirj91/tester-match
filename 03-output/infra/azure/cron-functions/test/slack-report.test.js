import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTotals } from "../src/cron-client.js";
import { errorMessage, formatCronRun, reportCronRun, shouldReport, summarizeTotals } from "../src/slack-report.js";

const WEBHOOK = "https://hooks.slack.com/services/T/B/x";
const okBody = '{"ok":true,"penalized":5,"deferred":0,"more":false}';
const okRun = {
  name: "penalty-sweep",
  durationMs: 4200,
  steps: [{ ok: true, rounds: 3, lastStatus: 200, lastBody: okBody, totals: mergeTotals({}, okBody) }],
};

function fakeFetch(status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status };
  };
  return { impl, calls };
}

test("summarizeTotals shows numbers, booleans and counts but no free text", () => {
  const totals = mergeTotals({}, JSON.stringify({ ok: true, more: false, sent: 21, emailSent: true, alerts: ["앱 <이름>", "b"], note: "secret text" }));
  assert.equal(summarizeTotals(totals), "sent=21 emailSent=true alerts=2건");
});

test("errorMessage escapes and trims the error message only", () => {
  const m = errorMessage(JSON.stringify({ ok: false, message: "<!channel> " + "x".repeat(300) }));
  assert.ok(m.startsWith("&lt;!channel&gt;"));
  assert.ok(m.length < 140);
  assert.equal(errorMessage("<html>"), "");
});

test("formatCronRun shows success, duration, rounds and summary", () => {
  assert.equal(formatCronRun(okRun), "✅ penalty-sweep · 4.2초 · 3회 호출 · penalized=5 deferred=0");
});

test("formatCronRun marks failures with the HTTP status", () => {
  const line = formatCronRun({
    name: "paid-orders-report",
    durationMs: 1000,
    steps: [
      { label: "스윕", ok: true, rounds: 2, lastStatus: 200, lastBody: "{}", totals: {} },
      { label: "리포트", ok: false, rounds: 1, lastStatus: 500, lastBody: '{"ok":false,"message":"boom"}', totals: {} },
    ],
  });
  assert.ok(line.startsWith("❌ paid-orders-report"));
  assert.ok(line.includes("스윕: 2회 호출"));
  assert.ok(line.includes("리포트: HTTP 500 (1회째) · message=boom"));
});

test("shouldReport sends everything by default and only failures in failures mode", () => {
  assert.equal(shouldReport(undefined, true), true);
  assert.equal(shouldReport("failures", true), false);
  assert.equal(shouldReport("failures", false), true);
});

test("reportCronRun posts one JSON message to the Slack webhook", async () => {
  const { impl, calls } = fakeFetch();
  const r = await reportCronRun({ webhookUrl: WEBHOOK, run: okRun, fetchImpl: impl });
  assert.equal(r, "sent");
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].init.body).text, formatCronRun(okRun));
});

test("reportCronRun skips without a webhook or with a non-Slack address", async () => {
  const { impl, calls } = fakeFetch();
  assert.equal(await reportCronRun({ webhookUrl: "", run: okRun, fetchImpl: impl }), "skipped");
  assert.equal(await reportCronRun({ webhookUrl: "https://evil.example/services/x", run: okRun, fetchImpl: impl }), "skipped");
  assert.equal(calls.length, 0);
});

test("reportCronRun never throws and never logs the webhook URL", async () => {
  const logs = [];
  const boom = async () => {
    throw new Error(`connect failed ${WEBHOOK}`);
  };
  const r = await reportCronRun({ webhookUrl: WEBHOOK, run: okRun, fetchImpl: boom, log: (m) => logs.push(m) });
  assert.equal(r, "failed");
  assert.ok(logs.every((m) => !m.includes("hooks.slack.com")));
});
