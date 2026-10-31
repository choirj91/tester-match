#!/usr/bin/env bash
# <abbr>-az: Azure CLI pinned to the Knock Knock Company tenant/subscription and ONE
# project resource group. Template generalised from tester-match 05-harness/scripts/tm-az.
# Rules and setup steps: 05-harness/templates/azure-account-isolation-guide.md
#
# Copy to the new project as <abbr>-az, chmod +x, and edit only the settings block below.
#
# Login and target identifiers are SHARED by every Knock Knock Company wrapper:
#   - isolated config dir  ~/.azure-knockknock-homepage  (one sign-in serves all wrappers)
#   - target.env           (tenant / subscription / account live only there, never in a repo)
# Only the resource group differs, so no wrapper can change another project's resources.
# Never touches ~/.azure (the employer's default Azure login).
#
# Read verbs run after a context check; every other command must name the
# subscription and stay inside $RG (optional exception: DNS in $SHARED_DNS_RG, step 5a).
#
# Exit codes: 2 wrong login context, 3 forbidden command/flag, 4 missing --subscription,
#             5 outside this project's scope, 9 template not configured.
set -euo pipefail

# ---- settings: edit these only -------------------------------------------------
SHARED_DIR="$HOME/.azure-knockknock-homepage"
RG="rg-CHANGE-ME-prod-krc"          # this project's resource group (lowercase)
LOCATION="koreacentral"             # the only region this project may create resources in
VAULT="kv-CHANGE-ME-prod-krc"       # this project's Key Vault ("" = no Key Vault secret commands)
SHARED_DNS_RG=""                    # "rg-knockknock-shared" to allow DNS zone/record changes there
# ----------------------------------------------------------------------------------

ME="${0##*/}"
stop()  { echo "STOP: $1. Do not work around it; report to the user." >&2; exit "${2:-9}"; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

[[ "$RG $VAULT" != *CHANGE-ME* ]] || stop "edit the settings block at the top of $ME first" 9
[[ -f "$SHARED_DIR/target.env" ]] || stop "$SHARED_DIR/target.env not found (the user creates it once for all wrappers)" 2
# shellcheck disable=SC1091
source "$SHARED_DIR/target.env"
: "${KH_AZ_TENANT:?missing}" "${KH_AZ_SUBSCRIPTION:?missing}" "${KH_AZ_ACCOUNT:?missing}"
TENANT="$KH_AZ_TENANT"
SUBSCRIPTION="$KH_AZ_SUBSCRIPTION"
ACCOUNT="$KH_AZ_ACCOUNT"

export AZURE_CONFIG_DIR="$SHARED_DIR"   # this process only
export AZURE_CORE_COLLECT_TELEMETRY=no

case "${1:-}" in
  login)   exec az login --tenant "$TENANT" --allow-no-subscriptions ;;  # user signs in
  use)     exec az account set --subscription "$SUBSCRIPTION" ;;          # shared isolated dir only
  version) exec az version ;;
esac

# 1) The signed-in context must match the shared target.env.
ctx_tenant=$(az account show --query tenantId -o tsv 2>/dev/null || true)
ctx_sub=$(az account show --query id -o tsv 2>/dev/null || true)
ctx_user=$(az account show --query user.name -o tsv 2>/dev/null || true)
[[ "$ctx_tenant" == "$TENANT" ]] || stop "tenant mismatch (the user runs '$ME login')" 2
[[ "$ctx_sub" == "$SUBSCRIPTION" ]] || stop "subscription mismatch (tenant matches, so '$ME use' is allowed)" 2
[[ "$(lower "$ctx_user")" == "$(lower "$ACCOUNT")" ]] || stop "account mismatch" 2

# 2) Split --opt=value so every check sees one form; refuse repeated scoping flags.
ARGS=()
for a in "$@"; do
  if [[ "$a" == --*=* ]]; then ARGS+=("${a%%=*}" "${a#*=}"); else ARGS+=("$a"); fi
done
value_of() {  # value_of -g --resource-group : value after the first matching flag
  local flags=" $* " i
  for ((i = 0; i < ${#ARGS[@]}; i++)); do
    if [[ "$flags" == *" ${ARGS[i]} "* ]]; then printf '%s' "${ARGS[i+1]:-}"; return; fi
  done
}
for f in "-g --resource-group" "--subscription" "--scope" "-n --name" "-l --location"; do
  n=0; for a in "${ARGS[@]}"; do [[ " $f " == *" $a "* ]] && n=$((n + 1)); done
  (( n <= 1 )) || stop "flag '$f' given more than once" 3
done

# 3) Commands that never go through this wrapper.
case "${ARGS[0]:-}" in
  logout|rest|ad|login) stop "'az ${ARGS[0]}' is unscoped and not allowed here" 3 ;;
esac
if [[ "${ARGS[0]:-}" == account ]]; then
  [[ "${ARGS[1]:-}" == show ]] || stop "only 'account show' is allowed; use '$ME use'" 3
  exec az "${ARGS[@]}"
fi
for a in "${ARGS[@]}"; do [[ "$a" == --ids ]] && stop "--ids is not allowed; use -g and --name" 3; done

# 3b) Key Vault secrets: only this project's vault, and never echo secret values.
if [[ "${ARGS[0]:-} ${ARGS[1]:-}" == "keyvault secret" ]]; then
  [[ -n "$VAULT" ]] || stop "no Key Vault is configured in $ME" 5
  [[ "$(lower "$(value_of --vault-name)")" == "$(lower "$VAULT")" ]] || stop "keyvault secret commands may only target $VAULT" 5
  case "${ARGS[2]:-}" in
    list|set|delete|set-attributes) ;;
    *) stop "'keyvault secret ${ARGS[2]:-}' is not allowed (could print values)" 3 ;;
  esac
  [[ "${ARGS[2]}" == list ]] && exec az "${ARGS[@]}" --subscription "$SUBSCRIPTION" --query "[].name" -o tsv
  [[ "$(value_of --subscription)" == "$SUBSCRIPTION" ]] || stop "pass --subscription explicitly" 4
  exec az "${ARGS[@]}" -o none
fi

# 4) Read verbs (allowlist) run with the subscription pinned.
verb=""
for a in "${ARGS[@]}"; do [[ "$a" == -* ]] && break; verb="$a"; done
if [[ "$verb" =~ ^(show|list|list-[a-z-]+|get|get-[a-z-]+|exists|check-name)$ ]]; then
  exec az "${ARGS[@]}" --subscription "$SUBSCRIPTION"
fi

# 5) Everything else counts as a change.
[[ "$(value_of --subscription)" == "$SUBSCRIPTION" ]] || stop "pass --subscription explicitly" 4
rg_l=$(lower "$RG")
scope=$(value_of --scope)
location=$(value_of -l --location)
if [[ -n "$location" && "$(lower "$location")" != "$(lower "$LOCATION")" ]]; then
  stop "location must be $LOCATION" 5
fi
# 5a) Optional shared DNS group: only creating that group and changing DNS zones/records
#     there is allowed — no other resource types, no zone delete.
if [[ -n "$SHARED_DNS_RG" ]]; then
  shared_l=$(lower "$SHARED_DNS_RG")
  if [[ "${ARGS[0]:-} ${ARGS[1]:-}" == "group create" && "$(lower "$(value_of -n --name)")" == "$shared_l" ]]; then
    exec az "${ARGS[@]}"
  fi
  if [[ "$(lower "$(value_of -g --resource-group)")" == "$shared_l" ]]; then
    [[ "${ARGS[0]:-} ${ARGS[1]:-}" == "network dns" ]] || stop "only 'network dns' commands may target $SHARED_DNS_RG" 5
    [[ "${ARGS[2]:-} ${ARGS[3]:-}" == "zone delete" ]] && stop "deleting the shared DNS zone is not allowed here" 5
    exec az "${ARGS[@]}"
  fi
fi

if [[ "${ARGS[0]:-}" == group ]]; then
  [[ "$(lower "$(value_of -n --name -g --resource-group)")" == "$rg_l" ]] || stop "group commands may only target $RG" 5
elif [[ -n "$scope" ]]; then
  [[ "$(lower "$scope")" =~ /resourcegroups/${rg_l}(/|$) ]] || stop "--scope must be inside $RG" 5
else
  [[ "$(lower "$(value_of -g --resource-group)")" == "$rg_l" ]] || stop "resource group must be $RG" 5
fi

exec az "${ARGS[@]}"
