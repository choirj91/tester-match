-- Read-only role for security watch ⑥ (unfamiliar database queries). The cron Function App's
-- secwatch-pg-snapshot timer logs in as it once a day and reads pg_stat_statements in `postgres`.
-- Run as the server admin on database `postgres`; the password comes from a psql variable and goes
-- to Key Vault as secwatch-pg-password — never commit it:
--   psql "host=<server>.postgres.database.azure.com dbname=postgres user=tmadmin sslmode=require" \
--     -v secwatch_password="$(cat <file>)" -f 05-secwatch-role.sql
--
-- Privileges: pg_read_all_stats only (normalized SQL and counters, no row data). Through PUBLIC it gets
-- what anon already has — on 2026-10-27 no table grants and 10 SECURITY DEFINER functions anon can call.
-- INHERIT (the default) is required, or the pg_read_all_stats membership grants nothing.
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
