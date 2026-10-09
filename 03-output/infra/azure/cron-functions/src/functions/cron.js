import { app } from "@azure/functions";
import { callCron } from "../cron-client.js";
import { reportCronRun } from "../slack-report.js";

/**
 * tester-match 정기 작업 — .github/workflows/cron.yml 과 같은 일정 (UTC, NCRONTAB 6필드).
 * Flex Consumption(Linux)의 타이머는 UTC 기준이다. KST = UTC+9.
 * 실패하면 throw → Functions 실행 실패로 기록되어 App Insights 경보 대상이 된다.
 *
 * 앱 설정: APP_URL (https://tester-match.knockknock.company), CRON_SECRET (Key Vault 참조),
 *          CRON_TIMERS_ENABLED=1 일 때만 실제로 호출 (병행 기간 이중 실행 방지 — 1-5단계에서 켠다).
 *          SLACK_OPS_WEBHOOK_URL 이 있으면 실행마다 결과 한 줄을 Slack 으로 (CRON_SLACK_MODE=failures 면 실패만).
 */

const JOBS = [
  // KST 16:00 — 체크인 리마인더
  { name: "checkin-reminder", schedule: "0 0 7 * * *", path: "/api/cron/daily-checkin-reminder" },
  // KST 21:00 — 미체크인 페널티 (more:true 반복)
  { name: "penalty-sweep", schedule: "0 0 12 * * *", path: "/api/cron/penalty-sweep", loop: true },
  // 6시간 간격 — 앱 초대 링크 검증
  { name: "validate-app-urls", schedule: "0 0 */6 * * *", path: "/api/cron/validate-app-urls" },
  // KST 09:00 — 급구 만료 + D-1 알림
  { name: "boost-expiry-sweep", schedule: "0 0 0 * * *", path: "/api/cron/boost-expiry-sweep" },
  // 월 KST 10:00 — 주간 인기글
  { name: "weekly-hot-posts", schedule: "0 0 1 * * 1", path: "/api/cron/weekly-hot-posts" },
  // 6시간 간격(:15) — 시트 보상 자동 확정·보정·출시 보너스 (반복)
  { name: "seat-reward-release", schedule: "0 15 */6 * * *", path: "/api/cron/seat-reward-release", loop: true },
  // 금 KST 22:00 — 주간 관리자 리포트 (지난 금 22:00 → 이번 금 22:00 회원별 크레딧·신뢰도 증가)
  { name: "weekly-report", schedule: "0 0 13 * * 5", path: "/api/cron/weekly-report" },
];

function env() {
  return { appUrl: process.env.APP_URL, secret: process.env.CRON_SECRET };
}

/** 실행 결과를 Slack 으로 — 보고 실패는 작업 결과에 영향을 주지 않는다 */
async function report(context, name, startedAt, steps) {
  await reportCronRun({
    webhookUrl: process.env.SLACK_OPS_WEBHOOK_URL,
    mode: process.env.CRON_SLACK_MODE,
    run: { name, durationMs: Date.now() - startedAt, steps },
    log: (m) => context.log(m),
  });
}

function enabled(context, name) {
  if (process.env.CRON_TIMERS_ENABLED === "1") return true;
  context.log(`${name}: skipped (CRON_TIMERS_ENABLED is not 1)`);
  return false;
}

for (const job of JOBS) {
  app.timer(job.name, {
    schedule: job.schedule,
    runOnStartup: false,
    handler: async (_timer, context) => {
      if (!enabled(context, job.name)) return;
      const startedAt = Date.now();
      const result = await callCron({ ...env(), path: job.path, loop: job.loop, log: (m) => context.log(m) });
      await report(context, job.name, startedAt, [result]);
      if (!result.ok) throw new Error(`${job.name} failed (HTTP ${result.lastStatus}, round ${result.rounds})`);
    },
  });
}

// KST 08:30 — 유료 주문 스윕(반복) 후 관리자 리포트. 스윕이 실패해도 리포트(운영 경보)는 보낸다.
app.timer("paid-orders-report", {
  schedule: "0 30 23 * * *",
  runOnStartup: false,
  handler: async (_timer, context) => {
    if (!enabled(context, "paid-orders-report")) return;
    const log = (m) => context.log(m);
    const startedAt = Date.now();
    const sweep = await callCron({ ...env(), path: "/api/cron/paid-orders-report?mode=sweep", loop: true, log });
    const daily = await callCron({ ...env(), path: "/api/cron/paid-orders-report", log });
    await report(context, "paid-orders-report", startedAt, [
      { label: "스윕", ...sweep },
      { label: "리포트", ...daily },
    ]);
    if (!sweep.ok || !daily.ok) {
      throw new Error(`paid-orders-report failed (sweep ok=${sweep.ok}, report ok=${daily.ok})`);
    }
  },
});
