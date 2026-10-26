import { app } from "@azure/functions";
import pg from "pg";
import { errorMessage, takeSnapshot } from "../pgss-snapshot.js";

/**
 * KST 06:30 — pg_stat_statements 스냅샷을 App Insights traces 로 (07:00 보안 점검 ⑥ 이 읽는다).
 *
 * 앱 설정: SECWATCH_PG_ENABLED=1 일 때만 실행. SECWATCH_PG_HOST (서버 FQDN), SECWATCH_PG_USER (secwatch_reader —
 *          pg_read_all_stats 만, 03-output/infra/azure/db/05-secwatch-role.sql), SECWATCH_PG_PASSWORD (Key Vault 참조).
 * 확장이 설치된 postgres DB 에 읽기 전용 트랜잭션으로 붙는다. 앱 DB(testermatch)에는 접속하지 않는다.
 * 실패하면 오류 trace 를 남기고 throw — 점검은 "확인 불가"로 보고, Functions 실행 실패로도 남는다.
 */
app.timer("secwatch-pg-snapshot", {
  schedule: "0 30 21 * * *",
  runOnStartup: false,
  handler: async (_timer, context) => {
    if (process.env.SECWATCH_PG_ENABLED !== "1") {
      context.log("secwatch-pg-snapshot: skipped (SECWATCH_PG_ENABLED is not 1)");
      return;
    }
    const at = new Date().toISOString();
    const client = new pg.Client({
      host: process.env.SECWATCH_PG_HOST,
      user: process.env.SECWATCH_PG_USER,
      password: process.env.SECWATCH_PG_PASSWORD,
      database: "postgres",
      ssl: true,
      application_name: "secwatch-pg-snapshot",
      connectionTimeoutMillis: 15_000,
      statement_timeout: 15_000,
      options: "-c default_transaction_read_only=on",
    });
    try {
      await client.connect();
      for (const message of await takeSnapshot(client, at)) context.log(message);
    } catch (err) {
      context.log(errorMessage({ at, error: err?.message ?? err }));
      throw err;
    } finally {
      await client.end().catch(() => {});
    }
  },
});
