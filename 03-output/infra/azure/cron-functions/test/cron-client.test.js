import { test } from "node:test";
import assert from "node:assert/strict";
import { callCron, hasMore, MAX_ROUNDS } from "../src/cron-client.js";

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
  assert.deepEqual(r, { ok: true, rounds: 1, lastStatus: 200 });
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
    assert.deepEqual(r, { ok: false, rounds: 1, lastStatus: status });
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
