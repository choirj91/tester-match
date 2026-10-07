/**
 * 앱의 /api/cron/* 를 호출하는 클라이언트 — .github/workflows/cron.yml 의 curl 루프를 옮긴 것.
 * 라우트는 요청당 처리량 상한이 있어 응답 본문에 "more": true 가 오면 다시 부른다.
 */

export const MAX_ROUNDS = 40;
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * @param {{ appUrl: string, secret: string, path: string, loop?: boolean,
 *           fetchImpl?: typeof fetch, log?: (msg: string) => void }} opts
 * @returns {Promise<{ ok: boolean, rounds: number, lastStatus: number, lastBody: string, totals: Totals }>}
 *   lastBody — 마지막 응답 본문 앞부분 (실패 메시지용), totals — 모든 회차 응답을 합친 요약 (Slack 결과 보고용)
 */
export async function callCron({ appUrl, secret, path, loop = false, fetchImpl = fetch, log = () => {} }) {
  if (!appUrl || !secret) throw new Error("APP_URL and CRON_SECRET must be set");
  const url = new URL(path, appUrl).toString();
  const maxRounds = loop ? MAX_ROUNDS : 1;

  let lastStatus = 0;
  let lastBody = "";
  let totals = {};
  for (let round = 1; round <= maxRounds; round++) {
    let body = "";
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        redirect: "manual", // cross-host 리다이렉트로 Authorization 이 새지 않게 (2026-08-15 교훈)
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      lastStatus = res.status;
      body = await res.text();
    } catch (err) {
      log(`${path} #${round} request failed: ${err instanceof Error ? err.message : String(err)}`);
      return { ok: false, rounds: round, lastStatus: 0, lastBody: "", totals };
    }
    lastBody = body.slice(0, 2000);
    totals = mergeTotals(totals, body);
    log(`${path} #${round} HTTP ${lastStatus} ${body.slice(0, 500)}`);
    if (lastStatus !== 200) return { ok: false, rounds: round, lastStatus, lastBody, totals };
    if (!hasMore(body)) return { ok: true, rounds: round, lastStatus, lastBody, totals };
  }
  return { ok: true, rounds: maxRounds, lastStatus, lastBody, totals };
}

/**
 * @typedef {Record<string, { type: "num" | "bool" | "count", value: number | boolean }>} Totals
 * 반복 호출 작업은 회차마다 처리한 건수를 돌려준다 — 마지막 회차만 보면 대개 0 이다.
 * 숫자는 회차 합, 배열은 길이 합(건), 참거짓은 마지막 값. 객체는 한 단계만 펼친다(referral.granted).
 * 대기·남은 건수처럼 "지금 상태"인 값은 합치지 않고 마지막 값을 쓴다.
 */
const LAST_VALUE_KEY = /(candidates|deferred|remaining|stuck|pending|total)/i;
const SKIP_KEYS = new Set(["ok", "more"]);

/** @returns {Totals} */
export function mergeTotals(totals, body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return totals;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return totals;
  const next = { ...totals };
  const add = (key, value) => {
    const keep = LAST_VALUE_KEY.test(key);
    if (typeof value === "number") {
      next[key] = { type: "num", value: keep ? value : (next[key]?.value ?? 0) + value };
    } else if (typeof value === "boolean") {
      next[key] = { type: "bool", value };
    } else if (Array.isArray(value)) {
      next[key] = { type: "count", value: keep ? value.length : (next[key]?.value ?? 0) + value.length };
    }
  };
  for (const [key, value] of Object.entries(parsed)) {
    if (SKIP_KEYS.has(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [child, childValue] of Object.entries(value)) add(`${key}.${child}`, childValue);
    } else {
      add(key, value);
    }
  }
  return next;
}

/** 응답 본문에 more:true 가 있는지. JSON 이 아니면 false. */
export function hasMore(body) {
  try {
    return JSON.parse(body)?.more === true;
  } catch {
    return false;
  }
}
