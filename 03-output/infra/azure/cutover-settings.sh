#!/usr/bin/env bash
# ADR-0015 phase 2: point an existing App Service app at the self-hosted Supabase services.
# Adds/updates only the settings below — every other app setting (PortOne, Google Workspace,
# Resend, Slack, allowlists …) is left as it is. Secrets are Key Vault references.
# Usage: cutover-settings.sh <app-name> <public-url> <google-client-id>
set -euo pipefail
APP="${1:?app name}" URL="${2:?public url, no trailing slash}" GCLIENT="${3:-}"
RG=rg-testermatch-prod-krc
KV='@Microsoft.KeyVault(VaultName=kv-testermatch-prod-krc;SecretName='
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
TM_AZ="$REPO/05-harness/scripts/tm-az"
set -a; . "$HOME/.azure-knockknock-homepage/target.env"; set +a
GOOGLE_ENABLED=false; [ -n "$GCLIENT" ] && GOOGLE_ENABLED=true
"$TM_AZ" webapp config appsettings set -g "$RG" -n "$APP" --subscription "$KH_AZ_SUBSCRIPTION" -o none --settings \
  "NEXT_PUBLIC_SUPABASE_URL=$URL" \
  "SUPABASE_REST_INTERNAL_URL=http://127.0.0.1:3001" \
  "SUPABASE_AUTH_INTERNAL_URL=http://127.0.0.1:9999" \
  "SUPABASE_SECRET_KEY=${KV}service-jwt)" \
  "AZURE_STORAGE_CONNECTION_STRING=${KV}azure-storage-connection-string)" \
  "PGRST_DB_URI=${KV}postgrest-db-uri)" "PGRST_JWT_SECRET=${KV}jwt-secret)" \
  "PGRST_DB_SCHEMAS=public" "PGRST_DB_ANON_ROLE=anon" "PGRST_DB_MAX_ROWS=1000" "PGRST_DB_POOL=10" \
  "PGRST_SERVER_HOST=127.0.0.1" "PGRST_SERVER_PORT=3001" \
  "GOTRUE_DB_DRIVER=postgres" "DATABASE_URL=${KV}gotrue-database-url)" "GOTRUE_JWT_SECRET=${KV}jwt-secret)" \
  "GOTRUE_JWT_EXP=3600" "GOTRUE_JWT_AUD=authenticated" "GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated" "GOTRUE_JWT_ADMIN_ROLES=service_role" \
  "API_EXTERNAL_URL=$URL/auth/v1" "GOTRUE_SITE_URL=$URL" "GOTRUE_URI_ALLOW_LIST=$URL/**" \
  "GOTRUE_API_HOST=127.0.0.1" "GOTRUE_API_PORT=9999" "GOTRUE_SIDECAR_PORT=9999" \
  "GOTRUE_DISABLE_SIGNUP=false" "GOTRUE_EXTERNAL_EMAIL_ENABLED=true" "GOTRUE_MAILER_AUTOCONFIRM=false" \
  "GOTRUE_EXTERNAL_GOOGLE_ENABLED=$GOOGLE_ENABLED" "GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=$GCLIENT" \
  "GOTRUE_EXTERNAL_GOOGLE_SECRET=${KV}google-client-secret)" "GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=$URL/auth/v1/callback"
echo "settings applied to $APP (google=$GOOGLE_ENABLED)"
