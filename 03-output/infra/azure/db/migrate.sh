#!/usr/bin/env bash
# Copy tester-match from Supabase to Azure PostgreSQL (ADR-0015 phase 2) and verify.
# Supabase is only read. The Azure database is DROPPED and rebuilt — run it for rehearsals and
# for the final sync at cutover (after crons are paused), never while the app writes to Azure.
#
# Secrets are read from files outside the repo (default: $SECRETS_DIR):
#   pgpw (server admin) · pg_authenticator · pg_authadmin · jwtsecret
# Requires: psql/pg_dump 17+, the Supabase CLI linked in <repo>/03-output, the GoTrue release
# binary + migrations in $GOTRUE_DIR (same version as the sidecar image).
set -euo pipefail

: "${SECRETS_DIR:?set SECRETS_DIR}" "${WORK_DIR:?set WORK_DIR (outside the repo — dumps contain personal data)}" "${GOTRUE_DIR:?set GOTRUE_DIR}"
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
AZ_HOST="${AZ_HOST:-psql-testermatch-prod-krc.postgres.database.azure.com}"
DB="${DB:-testermatch}"
umask 077
mkdir -p "$WORK_DIR"

echo "== 1. dump Supabase (read-only, temporary CLI login role)"
# the project link lives only in the main checkout's 03-output (not in worktrees)
SUPABASE_WORKDIR="${SUPABASE_WORKDIR:-$REPO/03-output}"
supabase db dump --linked --dry-run -s public --workdir "$SUPABASE_WORKDIR" 2>/dev/null | grep -E '^export PG' > "$WORK_DIR/pgenv.sh" \
  || { echo "could not get a Supabase login — is $SUPABASE_WORKDIR linked?"; exit 1; }
dump() { ( . "$WORK_DIR/pgenv.sh"; export PGSSLMODE=require; for i in 1 2 3; do pg_dump --role=postgres --no-owner --no-privileges "$@" && return 0; sleep 5; done; return 1 ); }
dump --schema-only -n public -f "$WORK_DIR/schema_public.sql"
dump --data-only -n public -f "$WORK_DIR/data_public.sql"
dump --data-only -t auth.users -t auth.identities -f "$WORK_DIR/data_auth.sql"

export PGHOST="$AZ_HOST" PGUSER=tmadmin PGSSLMODE=require PGPASSWORD="$(cat "$SECRETS_DIR/pgpw")"
echo "== 2. rebuild $DB on Azure"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB' and pid <> pg_backend_pid()" >/dev/null
psql -d postgres -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
psql -d "$DB" -q -v authenticator_password="$(cat "$SECRETS_DIR/pg_authenticator")" -v auth_admin_password="$(cat "$SECRETS_DIR/pg_authadmin")" -f "$HERE/01-roles.sql"

echo "== 3. GoTrue schema"
( cd "$GOTRUE_DIR"
  GOTRUE_DB_DRIVER=postgres GOTRUE_DB_MIGRATIONS_PATH=./migrations \
  DATABASE_URL="postgres://supabase_auth_admin:$(cat "$SECRETS_DIR/pg_authadmin")@$AZ_HOST:5432/$DB?sslmode=require&search_path=auth" \
  GOTRUE_JWT_SECRET="$(cat "$SECRETS_DIR/jwtsecret")" API_EXTERNAL_URL=http://localhost/auth/v1 GOTRUE_SITE_URL=http://localhost \
  ./auth migrate >/dev/null )

echo "== 4. data: auth → public schema → public data → grants → triggers"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -c "set role supabase_auth_admin" -f "$WORK_DIR/data_auth.sql" >/dev/null
psql -d "$DB" -v ON_ERROR_STOP=1 -q -c "set role supabase_auth_admin; grant references, trigger, select on auth.users to tmadmin;"
# the dump's "create schema public" is the only expected error
psql -d "$DB" -q -f "$WORK_DIR/schema_public.sql" 2>&1 | grep ERROR | grep -v 'schema "public" already exists' && { echo "schema restore errors"; exit 1; } || true
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$WORK_DIR/data_public.sql" >/dev/null
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/03-grants.sql" 2>&1 | grep -v "no privileges were granted" || true
psql -d "$DB" -v ON_ERROR_STOP=1 -q -c "set role supabase_auth_admin" -f "$HERE/04-auth-triggers.sql" 2>&1 | grep -v NOTICE || true

echo "== 5. verify (must be identical)"
( . "$WORK_DIR/pgenv.sh"; export PGSSLMODE=require; psql -q -c "set role postgres" -f "$HERE/verify.sql" | grep -v '^SET' ) > "$WORK_DIR/verify_supabase.txt"
psql -q -d "$DB" -f "$HERE/verify.sql" > "$WORK_DIR/verify_azure.txt"
if diff "$WORK_DIR/verify_supabase.txt" "$WORK_DIR/verify_azure.txt"; then
  echo "IDENTICAL ($(wc -l < "$WORK_DIR/verify_azure.txt") checks)"
else
  echo "MISMATCH — do not cut over"; exit 2
fi
