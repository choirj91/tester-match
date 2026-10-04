# 06 — Azure 계정 격리 런북

- 작성: 2026-10-04
- 목적: 이 컴퓨터의 **회사 Azure 로그인·기본 구독**과 Tester Match 용 Azure 를 섞지 않는다. 사고는 두 방향 — ① 이 프로젝트 리소스가 회사 구독에 생김 ② 이 작업 때문에 기본 로그인·구독이 바뀌어 회사 업무 세션이 엉뚱한 곳에 배포·삭제
- 이 문서의 절차는 해석 없이 그대로 따른다. 맞지 않는 상황이면 **멈추고 사용자에게 보고**한다.

## 0. 원칙 요약

| # | 규칙 | 작동 시점 |
|---|---|---|
| 1 | 대상 4종(테넌트 ID·구독 ID·구독 표시 이름·로그인 계정)은 사용자가 직접 준다. 목록에서 고르지 않는다 | 0단계 |
| 2 | 검토·계획 단계에선 Azure 명령 없음 (기본 프로필 조회 포함) | 지금까지 지켜짐 |
| 3 | Azure CLI 는 **회사 전용 설정 디렉터리** `~/.azure-knockknock-homepage` (홈페이지와 공유) 에서만. 기본 `~/.azure` 는 읽지도 쓰지도 않음 | 모든 명령 |
| 4 | 모든 명령에 `--subscription` 명시 + 변경 명령 직전 일치 확인, 불일치면 멈춤 | 래퍼 |
| 5 | 전용 리소스 그룹 `rg-testermatch-prod-krc` 안에서만 | 래퍼 + Policy |
| 6 | 회사 자산(앱 등록·서비스 주체·Key Vault·ACR·DNS 영역·네트워크) 재사용 금지 | 리뷰 |
| 7 | 로그인·MFA·동의 화면은 사용자가 직접 | 로그인 |
| 8 | 예산 알림이 첫 리소스보다 먼저 | 1-1 |
| 9 | 승인 게이트: 리소스 생성·데이터 복사·DNS·OAuth·크론 대상·운영 전환·해지 | 매 단계 |

## 1. 격리 설정 — knockknock-homepage 와 공유 (2026-10-04 확정)

회사 공식 홈페이지 이전(`knockknock-homepage`)이 먼저 같은 원칙으로 격리 설정을 만들었다. tester-match 는 **그 로그인과 대상 식별자를 그대로 쓰고, 리소스 그룹만 따로 쓴다.**

| 항목 | 값 | 소유 |
|---|---|---|
| 설정 디렉터리 | `~/.azure-knockknock-homepage` (로그인 1회로 두 래퍼 공용) | 홈페이지 작업 |
| 대상 식별자 | 같은 디렉터리의 `target.env` — `KH_AZ_TENANT`·`KH_AZ_SUBSCRIPTION`·`KH_AZ_SUBSCRIPTION_NAME`·`KH_AZ_ACCOUNT` (MS for Startups 스폰서십 구독) | 홈페이지 작업 — **tester-match 는 읽기만** |
| 래퍼 | 홈페이지 `scripts/kh-az` / tester-match `05-harness/scripts/tm-az` | 각자 |
| 리소스 그룹 | 홈페이지 `rg-homepage-prod-eas` (eastasia) / tester-match `rg-testermatch-prod-krc` (koreacentral) | 각자 — 서로의 그룹은 래퍼가 거부 (exit 5) |

- 식별자를 한 파일에만 둔다 → 두 프로젝트가 다른 구독을 가리키는 사고가 구조적으로 불가능. 값은 리포에 없다.
- `tm-az login` = `kh-az login` (같은 디렉터리). 한쪽에서 로그인하면 다른 쪽도 로그인 상태.
- 홈페이지 `target.env` 의 키 이름이 바뀌면 `tm-az` 가 `missing` 으로 멈춘다 — 정상 동작. 그때 `tm-az` 의 변수명만 맞춘다.
- 나중에 회사 제품이 늘면 디렉터리를 `~/.azure-knockknock` 같은 회사 공용 이름으로 옮기는 것을 검토 (두 래퍼 동시 수정 필요 — 홈페이지 세션과 협의).

**하지 않는 것**: `AZURE_CONFIG_DIR` 를 셸 프로필·전역 환경에 넣기, 홈페이지 `target.env` 수정, `kh-az` 로 tester-match 리소스 다루기.

## 2. 래퍼 `tm-az` — 구현 `05-harness/scripts/tm-az` (아래는 설계 원형, 실제 파일은 공유 설정을 읽도록 수정됨)

원칙: **읽기 동사만 허용 목록**으로 통과시키고, 나머지는 전부 변경으로 간주해 구독·리소스 그룹을 강제한다 (변경 동사 목록을 막는 방식은 `az rest`·`--ids`·새 동사로 새기 때문).

```bash
#!/usr/bin/env bash
# tm-az: Azure CLI pinned to the tester-match tenant, subscription and resource group.
# Never touches ~/.azure. Read verbs run after a context check; every other command
# must name the subscription and stay inside the dedicated resource group.
set -euo pipefail

TM_DIR="$HOME/.azure-tester-match"
# shellcheck disable=SC1091
source "$TM_DIR/target.env"
: "${TM_AZ_TENANT:?missing}" "${TM_AZ_SUBSCRIPTION:?missing}" "${TM_AZ_ACCOUNT:?missing}" "${TM_AZ_RG:?missing}"

export AZURE_CONFIG_DIR="$TM_DIR"   # this process only
export AZURE_CORE_COLLECT_TELEMETRY=no

stop()  { echo "STOP: $1. Do not work around it; report to the user." >&2; exit "${2:-9}"; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

case "${1:-}" in
  login)   exec az login --tenant "$TM_AZ_TENANT" --allow-no-subscriptions ;;  # user signs in
  use)     exec az account set --subscription "$TM_AZ_SUBSCRIPTION" ;;          # isolated dir only
  version) exec az version ;;
esac

# 1) The signed-in context must match target.env.
ctx_tenant=$(az account show --query tenantId -o tsv 2>/dev/null || true)
ctx_sub=$(az account show --query id -o tsv 2>/dev/null || true)
ctx_user=$(az account show --query user.name -o tsv 2>/dev/null || true)
[[ "$ctx_tenant" == "$TM_AZ_TENANT" ]] || stop "tenant mismatch" 2
[[ "$ctx_sub" == "$TM_AZ_SUBSCRIPTION" ]] || stop "subscription mismatch (tenant matches, so 'tm-az use' is allowed)" 2
[[ "$(lower "$ctx_user")" == "$(lower "$TM_AZ_ACCOUNT")" ]] || stop "account mismatch" 2

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
for f in "-g --resource-group" "--subscription" "--scope" "-n --name"; do
  n=0; for a in "${ARGS[@]}"; do [[ " $f " == *" $a "* ]] && n=$((n + 1)); done
  (( n <= 1 )) || stop "flag '$f' given more than once" 3
done

# 3) Commands that never go through this wrapper.
case "${ARGS[0]:-}" in
  logout|rest|ad|login) stop "'az ${ARGS[0]}' is unscoped and not allowed here" 3 ;;
esac
if [[ "${ARGS[0]:-}" == account ]]; then
  [[ "${ARGS[1]:-}" == show ]] || stop "only 'account show' is allowed; use 'tm-az use'" 3
  exec az "${ARGS[@]}"
fi
for a in "${ARGS[@]}"; do [[ "$a" == --ids ]] && stop "--ids is not allowed; use -g and --name" 3; done

# 4) Read verbs (allowlist) run with the subscription pinned.
verb=""
for a in "${ARGS[@]}"; do [[ "$a" == -* ]] && break; verb="$a"; done
if [[ "$verb" =~ ^(show|list|list-[a-z-]+|get|get-[a-z-]+|exists|check-name)$ ]]; then
  exec az "${ARGS[@]}" --subscription "$TM_AZ_SUBSCRIPTION"
fi

# 5) Everything else counts as a change.
[[ "$(value_of --subscription)" == "$TM_AZ_SUBSCRIPTION" ]] || stop "pass --subscription explicitly" 4
rg_l=$(lower "$TM_AZ_RG")
scope=$(value_of --scope)
if [[ "${ARGS[0]:-}" == group ]]; then
  [[ "$(lower "$(value_of -n --name -g --resource-group)")" == "$rg_l" ]] || stop "group commands may only target $TM_AZ_RG" 5
elif [[ -n "$scope" ]]; then
  [[ "$(lower "$scope")" =~ /resourcegroups/${rg_l}(/|$) ]] || stop "--scope must be inside $TM_AZ_RG" 5
else
  [[ "$(lower "$(value_of -g --resource-group)")" == "$rg_l" ]] || stop "resource group must be $TM_AZ_RG" 5
fi

exec az "${ARGS[@]}"
```

- 래퍼는 `exec` 로 끝나 환경변수가 호출한 셸에 남지 않는다. 식별자는 오류 메시지에도 출력하지 않는다.
- `tm-az use` 는 **전용 설정 디렉터리 안에서만** 구독을 고른다 (대상 테넌트에 구독이 여럿일 때 로그인 직후 기본값이 다를 수 있음). 기본 `~/.azure` 의 `az account set` 금지와 충돌하지 않는다.
- 래퍼로 하지 않는 일 (사용자가 포털에서, 사전 점검 + 승인 후): Entra 앱 등록·페더레이션 자격(`az ad`), 구독 범위 배포. 예산은 `az consumption budget create --resource-group` 으로 그룹 범위에 만든다.
- 일부 읽기 명령은 `--subscription` 을 받지 않을 수 있다 — 그때는 오류로 멈추며, 래퍼를 고치지 않고 사용자에게 보고한다.
- 실제 파일 차이: 설정·식별자를 `~/.azure-knockknock-homepage/target.env` 에서 읽음, 리소스 그룹·지역(`koreacentral`)은 스크립트에 고정, `-l/--location` 이 있으면 `koreacentral` 만 허용.
- 시험: 2026-10-04 가짜 `az` 스텁으로 실제 파일 14개 사례 실측 — 전부 기대값 (홈페이지 그룹 삭제·생성·scope 지정 모두 exit 5, 실제 Azure 호출 없음). 아래는 기대 종료 코드:

| 사례 | 기대 |
|---|---|
| target.env 구독 ID 한 글자 변경 후 `tm-az group list` | 2 |
| `tm-az account set -s X` · `tm-az rest --method delete …` · `tm-az ad app create …` | 3 |
| `tm-az resource delete --ids …` · `-g` 두 번 | 3 |
| `tm-az webapp create -g rg-testermatch-prod-krc …` (`--subscription` 없음) | 4 |
| `tm-az group delete -n other-rg --subscription <대상>` · `--scope …/resourceGroups/other` | 5 |
| `tm-az group delete -n rg-testermatch-prod-krc --subscription <대상>` (정상 롤백 경로) | 통과 (사전 점검·승인 후에만 실행) |

## 3. 사용자가 수행할 로그인 절차

1. 이미 `kh-az login` 을 했다면 생략 (같은 디렉터리). 아니면 터미널에서 `05-harness/scripts/tm-az login` 실행 (AI 가 아닌 **사용자**가).
2. 브라우저에서 `KH_AZ_ACCOUNT` 계정으로 로그인. 브라우저에 회사 계정이 이미 로그인돼 있으면 **계정 선택 화면에서 다른 계정 사용**을 고르거나 시크릿 창을 쓴다.
3. MFA·동의 완료.
4. `tm-az account show -o table` 로 테넌트·구독·계정 확인 → 사용자에게 보여주고 "일치" 확인을 받는다.
5. 기본 프로필이 그대로인지 사용자가 별도 터미널에서 직접 확인: `az account show -o table` → 회사 구독이 그대로 나와야 정상. (AI 는 이 명령을 실행하지 않는다 — 기본 프로필 조회 금지)

## 4. 사전 점검 형식 (변경 명령마다)

```
[사전 점검]
대상 테넌트 / 구독: (공유 target.env 값 끝 4자리) ↔ 현재 로그인: (tm-az account show 끝 4자리) → 일치/불일치
설정 디렉터리: ~/.azure-knockknock-homepage (회사 전용, 홈페이지와 공유 — 기본 ~/.azure 아님)
리소스 그룹: rg-testermatch-prod-krc (이 작업이 만든 전용 그룹)
할 일: (무엇을 만들고/바꾸는가)
예상 비용: (월 기준, 크레딧 적용 여부)
되돌리는 방법: (한 줄)
```

식별자 전체는 대화·로그에도 남기지 않고 끝 4자리만 보인다.

## 5. 코드형 인프라·배포 자동화에서 대상 고정

| 도구 | 고정 방법 |
|---|---|
| Bicep | `tm-az deployment group create --subscription $TM_AZ_SUBSCRIPTION -g rg-testermatch-prod-krc -f main.bicep` — 그룹 범위 배포만. 구독 범위 배포(`deployment sub`)는 리소스 그룹·예산 생성 시 1회만 |
| Terraform (쓴다면) | `provider "azurerm" { tenant_id = var.tenant_id  subscription_id = var.subscription_id }` 명시 + `use_cli = true` 를 `AZURE_CONFIG_DIR=~/.azure-knockknock-homepage` 아래에서만 실행. 변수 파일은 리포 밖. **`ARM_*` 환경변수 전역 설정 금지** |
| azd | 사용하지 않음 (기본 자격 증명·전역 설정을 쓰는 경로가 많음 [추정]) |
| GitHub Actions | `azure/login` + OIDC. 대상 테넌트에 새 앱 등록 `sp-testermatch-deploy`, 페더레이션 주체 `repo:<owner>/tester-match:environment:azure-prod` (GitHub Environment — 브랜치 무관, Required reviewers 로 배포 승인), 역할 **Website Contributor** 를 `rg-testermatch-prod-krc` 범위에만. ID 3종은 GitHub Secrets 에만 |
| Azure SDK 스크립트 | `DefaultAzureCredential` 금지 → `AzureCliCredential` + 래퍼 아래 실행, 또는 구독 ID 를 코드에서 명시 |
| VS Code Azure 확장 | 이 프로젝트에선 로그인하지 않음 — 확장은 기본 계정 세션을 공유할 수 있음 [추정] |

## 6. 해서는 안 되는 명령

| 명령 | 이유 |
|---|---|
| `az login` (래퍼 없이) | 기본 `~/.azure` 에 다른 계정이 섞임 |
| `az account set …` (래퍼 밖 어디서든) | 기본 구독 전환 → 회사 세션 오배포. 전용 디렉터리 안의 구독 선택은 `tm-az use` 로만 |
| `az logout`, `az account clear` | 회사 로그인 삭제 |
| `az account list`, `az account show` (래퍼 없이) | 회사 구독 정보 조회 — 이 작업과 무관 |
| `export AZURE_CONFIG_DIR=…` 를 셸 프로필에 | 다른 세션 영향 |
| `az group delete` / `az resource delete` 를 `rg-testermatch-*` 밖에서 | 남의 자원 삭제 |
| 회사 테넌트의 Key Vault·ACR·DNS 영역·앱 등록 ID 를 설정에 붙여넣기 | 자산 혼용 |
| `azd up`, `azd auth login` | 전역 자격 사용 |
| 크레딧 미적용 마켓플레이스 상품 배포 | 카드 청구 |

## 7. 실수했을 때 — 확인·복구 순서

**A. 회사 구독에 리소스를 만들었을 가능성**
1. 즉시 모든 작업 중단, 사용자에게 보고 (어떤 명령, 언제).
2. 사용자가 **회사 프로필**에서 직접 확인: `az resource list --tag project=tester-match -o table` 및 활동 로그(최근 1시간, 호출자 = 본인).
3. 해당 리소스가 이 작업이 만든 것이 확실할 때만 사용자가 삭제. 회사 관리자 보고 여부는 사용자가 판단.
4. 원인(래퍼 미사용 등) 기록 → `04-review/history/` 에 사고 기록.

**B. 기본 로그인·구독이 바뀌었을 가능성**
1. 중단·보고.
2. 사용자가 회사 프로필에서 `az account show` 로 확인 → 원래 구독으로 사용자가 직접 복구.
3. 같은 컴퓨터의 다른 세션에 "최근 N분간 Azure 작업 대상 확인" 공지.

**C. 대상 구독에서 엉뚱한 리소스 그룹을 건드렸을 가능성**
1. 중단·보고. 2. 활동 로그로 변경 내용 확인. 3. 이 작업이 만든 리소스가 아니면 되돌리기도 사용자 승인 후.

## 8. 체크리스트 — "회사 구독에 실수로 리소스가 만들어지는 것"을 막는 장치

| 장치 | 단계 | 무엇을 막나 |
|---|---|---|
| 전용 설정 디렉터리 | 로그인 | 회사 자격으로 명령 실행 |
| 래퍼 일치 검사 (테넌트·구독·계정) | 모든 명령 | 잘못된 컨텍스트 |
| `--subscription` 필수 | 변경 명령 | 기본 구독 암묵 사용 |
| 리소스 그룹 고정 | 변경 명령 | 그룹 밖 변경 |
| 사전 점검 블록 + 승인 | 변경 명령 직전 | 사람의 확인 누락 |
| Azure Policy (위치·태그) | 리소스 생성 시 | 태그 없는/다른 지역 생성 |
| GitHub OIDC 권한 = 그룹 범위 | 자동 배포 | 자동화의 범위 초과 |
| 예산 알림 | 과금 | 실수의 비용 확대 |
