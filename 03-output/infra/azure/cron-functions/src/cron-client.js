/**
 * 앱의 /api/cron/* 를 호출하는 클라이언트 — .github/workflows/cron.yml 의 curl 루프를 옮긴 것.
 * 라우트는 요청당 처리량 상한이 있어 응답 본문에 "more": true 가 오면 다시 부른다.
 */

export const MAX_ROUNDS = 40;
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * @param {{ appUrl: string, secret: string, path: string, loop?: boolean,
 *           fetchImpl?: typeof fetch, log?: (msg: string) => void }} opts
 * @returns {Promise<{ ok: boolean, rounds: number, lastStatus: number }>}
 */
export async function callCron({ appUrl, secret, path, loop = false, fetchImpl = fetch, log = () => {} }) {
  if (!appUrl || !secret) throw new Error("APP_URL and CRON_SECRET must be set");
  const url = new URL(path, appUrl).toString();
  const maxRounds = loop ? MAX_ROUNDS : 1;

  let lastStatus = 0;
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
      return { ok: false, rounds: round, lastStatus: 0 };
    }
    log(`${path} #${round} HTTP ${lastStatus} ${body.slice(0, 500)}`);
    if (lastStatus !== 200) return { ok: false, rounds: round, lastStatus };
    if (!hasMore(body)) return { ok: true, rounds: round, lastStatus };
  }
  return { ok: true, rounds: maxRounds, lastStatus };
}

/** 응답 본문에 more:true 가 있는지. JSON 이 아니면 false. */
export function hasMore(body) {
  try {
    return JSON.parse(body)?.more === true;
  } catch {
    return false;
  }
}
