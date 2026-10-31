import { app } from "@azure/functions";
import pg from "pg";
import { runSnapshot } from "../pgss-snapshot.js";

/**
 * KST 06:30 — pg_stat_statements 스냅샷을 App Insights traces 로 (07:00 보안 점검 ⑥ 이 읽는다).
 *
 * 앱 설정: SECWATCH_PG_ENABLED=1 일 때만 실행. SECWATCH_PG_HOST (서버 FQDN), SECWATCH_PG_USER (secwatch_reader —
 *          pg_read_all_stats 만, 03-output/infra/azure/db/05-secwatch-role.sql), SECWATCH_PG_PASSWORD (Key Vault 참조).
 * 확장이 설치된 postgres DB 에 읽기 전용 트랜잭션으로 붙는다. 앱 DB(testermatch)에는 접속하지 않는다.
 * 본체와 테스트: ../pgss-snapshot.js runSnapshot.
 */
app.timer("secwatch-pg-snapshot", {
  schedule: "0 30 21 * * *",
  runOnStartup: false,
  handler: async (_timer, context) => {
    await runSnapshot({ env: process.env, Client: pg.Client, log: (m) => context.log(m) });
  },
});
