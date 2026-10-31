-- Read-only role for security watch ⑥ (unfamiliar database queries). The cron Function App's
-- secwatch-pg-snapshot timer logs in as it once a day and reads pg_stat_statements in `postgres`.
-- Run as the server admin on database `postgres`. The plaintext password goes only to Key Vault
-- (secwatch-pg-password); the server gets a SCRAM verifier, because this statement's text can stay in
-- pg_stat_statements. Never commit either:
--   psql "host=<server>.postgres.database.azure.com dbname=postgres user=tmadmin sslmode=require" \
--     -v secwatch_password="$(node scram-verifier.mjs < <password-file>)" -f 05-secwatch-role.sql
--
-- Privileges: pg_read_all_stats only. That shows pg_stat_statements and pg_stat_activity for every
-- role: normalized SQL and counters, plus whatever literals utility statements and live queries carry.
-- No table rows. Through PUBLIC it gets what anon already has — on 2026-10-27 no table grants and
-- 10 SECURITY DEFINER functions anon can call. INHERIT (the default) is required, or the
-- pg_read_all_stats membership grants nothing. The watch also judges this role's own queries.
\set ON_ERROR_STOP on

do $$
begin
  if not exists (select from pg_roles where rolname = 'secwatch_reader') then
    create role secwatch_reader login inherit;
  end if;
end $$;

alter role secwatch_reader with login inherit connection limit 2 password :'secwatch_password';
grant pg_read_all_stats to secwatch_reader;
alter role secwatch_reader set default_transaction_read_only = on;
alter role secwatch_reader set statement_timeout = '15s';

select rolname, rolcanlogin, rolinherit, rolconnlimit,
       pg_has_role(oid, 'pg_read_all_stats', 'usage') as reads_all_stats,
       rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls as elevated,
       rolconfig
  from pg_roles where rolname = 'secwatch_reader';
