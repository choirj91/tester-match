#!/usr/bin/env node
/**
 * Capture or extend the baseline for ⑥ from the latest pg_stat_statements snapshot in App Insights.
 *
 *   node 05-harness/security-watch/pg-baseline.mjs           every shape seen since pgss was enabled
 *   node 05-harness/security-watch/pg-baseline.mjs --merge   add new shapes to the existing baseline
 *     --allow <queryid>  keep a flagged shape after checking its SQL with psql (repeatable)
 *     --dry-run          print the summary only
 *
 * Runs on the operator's machine through 05-harness/scripts/tm-az (the App Insights query is a read).
 * Review the pg-baseline.json diff and merge it by PR. The file holds role, database, verb, tables and
 * queryid only, no SQL text, because the repository is public.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBaseline, parseSnapshots, publicTablesFrom, SNAPSHOT_FUNCTION, TRACE_PREFIX } from "./pg-queries.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../..");
const TM_AZ = join(REPO, "05-harness/scripts/tm-az");
const BASELINE = join(HERE, "pg-baseline.json");
const MIGRATIONS = join(REPO, "03-output/supabase/migrations");
const RG = process.env.SECWATCH_RG || "rg-testermatch-prod-krc";
const APPI = process.env.SECWATCH_APPINSIGHTS || "appi-testermatch-prod-krc";

const args = process.argv.slice(2);
const merge = args.includes("--merge");
const dryRun = args.includes("--dry-run");
const allow = args.flatMap((a, i) => (a === "--allow" && args[i + 1] ? [args[i + 1]] : []));

const tmAz = (argv) => execFileSync(TM_AZ, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const subscription = tmAz(["account", "show", "--query", "id", "-o", "tsv"]).trim();
const result = JSON.parse(
  tmAz([
    "monitor", "app-insights", "query", "--app", APPI, "-g", RG, "--subscription", subscription, "--offset", "3d",
    "--analytics-query",
    `traces | where timestamp > ago(3d) and operation_Name == '${SNAPSHOT_FUNCTION}' and message startswith '${TRACE_PREFIX}' | project message`,
    "-o", "json",
  ]),
);
const table = result.tables[0];
const traces = table.rows.map((row) => Object.fromEntries(table.columns.map((c, i) => [c.name, row[i]])));
const snapshot = parseSnapshots(traces).find((s) => s.complete);
if (!snapshot) {
  console.error("No complete snapshot in the last 3 days. Has secwatch-pg-snapshot run with SECWATCH_PG_ENABLED=1?");
  process.exit(1);
}

const publicTables = publicTablesFrom(
  readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(join(MIGRATIONS, f), "utf8")),
);
const existing = JSON.parse(readFileSync(BASELINE, "utf8"));
const { baseline, added, flagged } = buildBaseline({
  snapshot, existing, publicTables, merge, allow, capturedAt: new Date().toISOString(),
});

const byRole = {};
for (const e of added) byRole[`${e.role}@${e.db}`] = (byRole[`${e.role}@${e.db}`] ?? 0) + 1;
console.log(`snapshot ${snapshot.at}: ${snapshot.entries.length} shapes · ${merge ? "merge" : "replace"} · +${added.length}`);
for (const [who, n] of Object.entries(byRole)) console.log(`  + ${who} ${n}`);
if (flagged.length) {
  console.log(`\nLeft out (rule hits, check the SQL with psql and pass --allow <queryid> if it is normal):`);
  for (const f of flagged) console.log(`  ! ${f.role}@${f.db} ${f.verb} ${f.tables.join(", ") || "-"} queryid ${f.queryid} — ${f.reason}`);
}
if (dryRun) {
  console.log("\n(dry run, pg-baseline.json not written)");
} else {
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`\nwrote ${BASELINE} (${baseline.entries.length} entries)`);
}
