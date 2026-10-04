import { app } from "@azure/functions";
import { callCron } from "../cron-client.js";

/**
 * tester-match 정기 작업 — .github/workflows/cron.yml 과 같은 일정 (UTC, NCRONTAB 6필드).
 * Flex Consumption(Linux)의 타이머는 UTC 기준이다. KST = UTC+9.
 * 실패하면 throw → Functions 실행 실패로 기록되어 App Insights 경보 대상이 된다.
 *
 * 앱 설정: APP_URL (https://tester-match.knockknock.company), CRON_SECRET (Key Vault 참조),
 *          CRON_TIMERS_ENABLED=1 일 때만 실제로 호출 (병행 기간 이중 실행 방지 — 1-5단계에서 켠다).
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
];

function env() {
  return { appUrl: process.env.APP_URL, secret: process.env.CRON_SECRET };
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
      const result = await callCron({ ...env(), path: job.path, loop: job.loop, log: (m) => context.log(m) });
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
    const sweep = await callCron({ ...env(), path: "/api/cron/paid-orders-report?mode=sweep", loop: true, log });
    const report = await callCron({ ...env(), path: "/api/cron/paid-orders-report", log });
    if (!sweep.ok || !report.ok) {
      throw new Error(`paid-orders-report failed (sweep ok=${sweep.ok}, report ok=${report.ok})`);
    }
  },
});
