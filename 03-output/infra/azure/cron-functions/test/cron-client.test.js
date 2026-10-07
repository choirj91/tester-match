import { test } from "node:test";
import assert from "node:assert/strict";
import { callCron, hasMore, MAX_ROUNDS, mergeTotals } from "../src/cron-client.js";

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return { status: next.status, text: async () => next.body ?? "" };
  };
  return { impl, calls };
}

const base = { appUrl: "https://app.example", secret: "s3cret" };

test("sends Bearer secret, POST, no redirect following", async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: "{}" }]);
  const r = await callCron({ ...base, path: "/api/cron/x", fetchImpl: impl });
  assert.deepEqual(r, { ok: true, rounds: 1, lastStatus: 200, lastBody: "{}", totals: {} });
  assert.equal(calls[0].url, "https://app.example/api/cron/x");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer s3cret");
  assert.equal(calls[0].init.redirect, "manual");
});

test("loops while more:true and stops when done", async () => {
  const { impl, calls } = fakeFetch([
    { status: 200, body: '{"more":true}' },
    { status: 200, body: '{"more":true}' },
    { status: 200, body: '{"more":false}' },
  ]);
  const r = await callCron({ ...base, path: "/p", loop: true, fetchImpl: impl });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 3);
});

test("non-loop job calls once even if more:true", async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: '{"more":true}' }]);
  await callCron({ ...base, path: "/p", fetchImpl: impl });
  assert.equal(calls.length, 1);
});

test("caps the loop at MAX_ROUNDS", async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: '{"more":true}' }]);
  const r = await callCron({ ...base, path: "/p", loop: true, fetchImpl: impl });
  assert.equal(r.ok, true);
  assert.equal(calls.length, MAX_ROUNDS);
});

test("fails on non-200, including redirects", async () => {
  for (const status of [401, 308, 500]) {
    const { impl } = fakeFetch([{ status }]);
    const r = await callCron({ ...base, path: "/p", loop: true, fetchImpl: impl });
    assert.deepEqual({ ok: r.ok, rounds: r.rounds, lastStatus: r.lastStatus }, { ok: false, rounds: 1, lastStatus: status });
  }
});

test("fails when the request throws (timeout, DNS)", async () => {
  const { impl } = fakeFetch([new Error("timeout")]);
  const r = await callCron({ ...base, path: "/p", fetchImpl: impl });
  assert.equal(r.ok, false);
});

test("refuses to run without APP_URL or CRON_SECRET", async () => {
  await assert.rejects(() => callCron({ appUrl: "", secret: "x", path: "/p" }));
  await assert.rejects(() => callCron({ appUrl: "https://a", secret: "", path: "/p" }));
});

test("hasMore only trusts parsed JSON", () => {
  assert.equal(hasMore('{"more":true}'), true);
  assert.equal(hasMore('{"note":"\\"more\\":true"}'), false);
  assert.equal(hasMore("not json"), false);
});

test("looped jobs sum work done across rounds, keep the latest backlog", async () => {
  const { impl } = fakeFetch([
    { status: 200, body: '{"ok":true,"released":4,"stuckDue":3,"referral":{"granted":1,"remaining":2},"more":true}' },
    { status: 200, body: '{"ok":true,"released":2,"stuckDue":1,"referral":{"granted":1,"remaining":0},"more":false}' },
  ]);
  const r = await callCron({ ...base, path: "/p", loop: true, fetchImpl: impl });
  assert.equal(r.totals.released.value, 6);
  assert.equal(r.totals.stuckDue.value, 1);
  assert.equal(r.totals["referral.granted"].value, 2);
  assert.equal(r.totals["referral.remaining"].value, 0);
  assert.equal(r.lastBody.includes('"released":2'), true);
});

test("request failure returns empty body and the totals gathered so far", async () => {
  const { impl } = fakeFetch([{ status: 200, body: '{"released":1,"more":true}' }, new Error("timeout")]);
  const r = await callCron({ ...base, path: "/p", loop: true, fetchImpl: impl });
  assert.equal(r.ok, false);
  assert.equal(r.lastBody, "");
  assert.equal(r.totals.released.value, 1);
});

test("mergeTotals ignores non-JSON bodies", () => {
  assert.deepEqual(mergeTotals({}, "<html>"), {});
});
