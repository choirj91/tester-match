# 낰낰컴퍼니 Azure 배포 규칙 — 회사(직장) 계정과 분리하기

> 용도: 새 프로젝트의 Azure 배포를 사람이나 AI 에이전트에게 맡길 때 이 문서와 [azure-wrapper-template.sh](azure-wrapper-template.sh) 를 같이 넘긴다.
> 근거: tester-match ADR-0015, 실제 래퍼 `05-harness/scripts/tm-az`, 2026-10-05 운영 전환 후 실제 운영 기록 (2026-10-09 기준).
> tester-match 전용 상세 런북: `03-output/azure-migration/06-isolation-runbook.md` (그 문서의 래퍼 코드는 구현 전 설계안이라 실제 파일과 다르다. 래퍼는 템플릿을 쓴다).
> 공개 저장소에 두는 문서다. 테넌트 ID·구독 ID·계정 메일은 적지 않는다.

---

## 1. 왜 분리하는가

이 맥의 기본 Azure 로그인(`~/.azure`)은 **회사(직장) 계정**이다. 사고는 두 방향이다.

1. 낰낰컴퍼니 리소스가 회사 구독에 생긴다 (비용·보안 책임이 섞임).
2. 낰낰컴퍼니 작업이 기본 로그인·구독을 바꿔서, 회사 업무 세션이 엉뚱한 곳에 배포·삭제한다.

그래서 낰낰컴퍼니 작업은 **별도 설정 폴더 + 대상 고정 파일 + 프로젝트별 래퍼**로만 한다. 맨손 `az` 는 쓰지 않는다.

## 2. 구조

```
~/.azure                              회사 계정. 읽지도 쓰지도 않음

~/.azure-knockknock-homepage/         낰낰컴퍼니 전용 Azure CLI 설정 폴더 (AZURE_CONFIG_DIR)
  ├─ (az 로그인 토큰)                    한 번 로그인하면 모든 낰낰컴퍼니 래퍼가 같이 씀
  └─ target.env                       대상 테넌트·구독·계정. 이 파일에만 존재, 저장소에 없음

프로젝트마다:
  <약어>-az 래퍼                        위 폴더·target.env 를 읽고, 자기 리소스 그룹만 허용
  rg-<프로젝트>-prod-<지역약어>           프로젝트 하나 = 리소스 그룹 하나

  현재:
  knockknock-homepage  scripts/kh-az            → rg-homepage-prod-eas     (eastasia)
  tester-match         05-harness/scripts/tm-az → rg-testermatch-prod-krc  (koreacentral)
  공유 DNS             rg-knockknock-shared       (knockknock.company 존만)
```

- **로그인은 공유, 리소스는 분리.** 모든 래퍼가 같은 `target.env` 를 읽으므로 프로젝트끼리 다른 구독을 가리킬 수 없다. 래퍼마다 리소스 그룹이 고정이라 다른 프로젝트 리소스는 바꿀 수 없다 (exit 5).
- `target.env` 키: `KH_AZ_TENANT`, `KH_AZ_SUBSCRIPTION`, `KH_AZ_ACCOUNT` (+ 표시용 `KH_AZ_SUBSCRIPTION_NAME`). 값은 사용자가 직접 넣는다. 저장소·대화·로그에 붙여넣지 않는다.
- 폴더 이름에 `homepage` 가 붙은 건 홈페이지 작업이 먼저 만들었기 때문이다. 이름을 바꾸려면 모든 래퍼를 한 번에 고쳐야 하니 함부로 옮기지 않는다.
- `AZURE_CONFIG_DIR` 는 래퍼 프로세스 안에서만 바뀐다. 셸 프로필·전역 환경에 넣지 않는다.

## 3. 래퍼가 하는 일

설계 원칙: **읽기 동사만 허용 목록**으로 통과시키고, 나머지는 전부 변경으로 보고 구독·리소스 그룹을 강제한다. 변경 동사 목록을 막는 방식은 `az rest`·`--ids`·새 동사로 샌다.

| 순서 | 검사 | 막히면 |
|---|---|---|
| 1 | 현재 로그인의 테넌트·구독·계정이 `target.env` 와 같은가 | exit 2 |
| 2 | `--opt=value` 를 나눠 검사, 범위 플래그(`-g`·`--subscription`·`--scope`·`-n`·`-l`) 중복 거부 | exit 3 |
| 3 | 금지 명령: `login`·`logout`·`rest`·`ad`, `account show` 외의 `account`, `--ids` | exit 3 |
| 3b | Key Vault 비밀: 자기 볼트만, `list`(이름만)·`set`·`delete`·`set-attributes` 만, 출력 끔. `show`·`download` 금지 | exit 3·5 |
| 4 | 읽기(`show`·`list`·`get`·`exists`·`check-name`)는 구독을 붙여 실행 | 통과 |
| 5 | 그 밖은 변경: `--subscription` 명시 필수, 지역 고정, 자기 리소스 그룹(또는 그 안의 `--scope`)만 | exit 4·5 |
| 5a | (선택) 공유 DNS 그룹: `network dns` 만, 존 삭제 금지 | exit 5 |

- 래퍼 전용 명령: `<래퍼> login` (사용자가 브라우저로 직접 로그인), `<래퍼> use` (전용 폴더 안에서만 구독 선택).
- 막히면 `STOP: … Do not work around it; report to the user.` 를 출력한다. 에이전트는 우회하지 않고 사용자에게 보고한다.
- 식별자는 오류 메시지에도 찍지 않는다.

## 4. 규칙 (위반하면 멈추고 사용자에게 보고)

1. **Azure CLI 는 프로젝트 래퍼로만.** `az …` 직접 실행 금지.
2. **로그인·MFA·동의 화면은 사용자가 직접.** 브라우저에 회사 계정이 로그인돼 있으면 "다른 계정 사용" 또는 시크릿 창.
3. **변경 명령은 `--subscription` 명시 + 자기 리소스 그룹 + 정해진 지역.** 구독 값은 `target.env` 에서 읽는다: `--subscription "$(. ~/.azure-knockknock-homepage/target.env; echo "$KH_AZ_SUBSCRIPTION")"`.
4. **회사 자산 재사용 금지.** 회사 테넌트의 Key Vault·ACR·DNS 존·앱 등록·네트워크를 설정에 쓰지 않는다.
5. **비밀값은 사람이 넣는다.** 에이전트는 값을 보거나 출력하지 않는다. 사용자가 터미널 앱(Claude 앱 입력창은 숨김 입력을 못 받음)에서:
   ```bash
   read -rs "V?값 붙여넣기: " && f=$(mktemp) && printf %s "$V" > "$f" && unset V && <래퍼경로> keyvault secret set --vault-name <볼트> --name <비밀이름> --file "$f" --subscription "$(. ~/.azure-knockknock-homepage/target.env; echo "$KH_AZ_SUBSCRIPTION")"; rm -f "$f"
   ```
   (zsh 문법. bash 는 `read -rsp "값 붙여넣기: " V`)
6. **앱 비밀은 Key Vault 참조로만** App Service·Functions 설정에 넣는다: `@Microsoft.KeyVault(VaultName=<볼트>;SecretName=<이름>)`. 앱에는 관리 ID + 볼트 읽기 역할(Key Vault Secrets User). 평문 비밀을 앱 설정에 넣지 않는다.
7. **배포 자동화는 GitHub Actions + OIDC.** 저장소에 Azure 키를 두지 않는다.
   - 앱 등록 `sp-<프로젝트>-deploy` (래퍼가 `az ad` 를 막으므로 **사용자가 포털에서** 만든다)
   - 페더레이션 주체 `repo:<owner>/<repo>:environment:<환경>` (브랜치 무관, Environment 기준)
   - 역할은 **자기 리소스 그룹 범위의 최소 역할** (App Service 배포면 Website Contributor)
   - Environment secrets `AZURE_CLIENT_ID`·`AZURE_TENANT_ID`·`AZURE_SUBSCRIPTION_ID`
   - Environment 에 Required reviewers (배포 승인 게이트), 워크플로는 `workflow_dispatch` 수동 실행만
8. **빌드 때 들어가는 공개값**(`NEXT_PUBLIC_*` 등)은 GitHub 변수. **같은 이름이면 Environment 변수가 저장소 변수를 이긴다.** 바꿀 때는 `gh variable set <이름> --env <환경>`.
9. **로컬 운영 접속 정보**(DB 관리자 URI 등)는 저장소 밖 `~/.config/<프로젝트>/*.env` (권한 600)에만.
10. **예산 알림은 리소스 그룹마다, 첫 리소스보다 먼저.** 낰낰컴퍼니 프로젝트들이 같은 스폰서십 구독을 나눠 쓴다. 사양을 올리면 예산도 같이 올린다.
11. **공유 리소스는 별도 그룹**(`rg-knockknock-shared`). 래퍼에는 꼭 필요한 예외만 연다.
12. **공개 저장소에 테넌트·구독 ID·계정 메일 금지.** 리소스 이름(`rg-…`, `kv-…`)은 써도 된다. 대화에서 보여야 하면 끝 4자리만.
13. **운영 변경은 매번 사용자 승인.** 리소스 생성·삭제, 앱 설정 변경, 운영 DB 쓰기, 배포 승인 게이트 통과.

### 쓰지 않는 것

| 명령 | 이유 |
|---|---|
| `az login`·`az logout`·`az account set`·`az account clear` (래퍼 밖) | 회사 로그인·기본 구독이 바뀜 |
| `az account show/list` (래퍼 밖) | 회사 구독 조회. 이 작업과 무관 |
| `azd up`·`azd auth login` | 전역 자격 사용 |
| SDK 의 `DefaultAzureCredential` | 기본 프로필을 집어 갈 수 있음. `AzureCliCredential` + 래퍼 환경, 또는 구독 ID 명시 |
| VS Code Azure 확장 로그인 | 기본 계정 세션과 섞일 수 있음 |

## 5. 이름 규칙

| 대상 | 형식 | 예 (tester-match) |
|---|---|---|
| 리소스 그룹 | `rg-<프로젝트>-prod-<지역약어>` | `rg-testermatch-prod-krc` |
| App Service / 플랜 | `app-…` / `asp-…` | `app-testermatch-prod-krc` |
| Functions | `func-<프로젝트>-<용도>-<지역약어>` | `func-testermatch-cron-krc` |
| Key Vault | `kv-<프로젝트>-prod-<지역약어>` (24자 이하) | `kv-testermatch-prod-krc` |
| PostgreSQL | `psql-…` | `psql-testermatch-prod-krc` |
| App Insights | `appi-…` | `appi-testermatch-prod-krc` |
| 배포용 앱 등록 | `sp-<프로젝트>-deploy` | `sp-testermatch-deploy` |
| 래퍼 | `<약어>-az` | `tm-az`, `kh-az` |
| 지역 | 한국 서비스는 Korea Central (`koreacentral`, 약어 `krc`) | |

## 6. 새 프로젝트 시작 순서

1. **래퍼 만들기.** [azure-wrapper-template.sh](azure-wrapper-template.sh) 를 프로젝트에 `<약어>-az` 로 복사하고 맨 위 설정 4줄(리소스 그룹·지역·볼트·공유 DNS 그룹)만 바꾼다. `chmod +x`. `CHANGE-ME` 가 남아 있으면 실행이 멈춘다.
2. **로그인 확인.** `<래퍼> account show -o table` 로 테넌트·구독·계정이 맞는지 사용자에게 보여준다. 만료됐으면 사용자가 `<래퍼> login`.
3. **리소스 그룹.** `<래퍼> group create -n rg-<프로젝트>-prod-krc -l koreacentral --subscription <구독>`.
4. **예산 알림.** 리소스 그룹 범위 월 예산 + 알림 (tester-match 예: `03-output/infra/azure/budget.json`).
5. **Key Vault + 관리 ID.** 비밀은 4-5 절차로 사용자가 넣고, 앱 설정에는 참조만.
6. **배포 경로.** 앱 등록·페더레이션(사용자, 포털) → 역할 할당(래퍼, `--scope` 는 자기 그룹) → GitHub Environment + 승인자 → 워크플로.
7. **프로젝트 규칙 문서**(CLAUDE.md·AGENTS.md)에 잠금 결정 한 줄: "Azure 명령은 `<경로>/<약어>-az` 로만. 회사 계정(`~/.azure`) 혼용 금지."

## 7. 배포 방식 (tester-match 에서 쓰는 것)

| 대상 | 방법 | 누가 시작 |
|---|---|---|
| 웹 앱 (App Service) | GitHub Actions 수동 실행 `gh workflow run "<워크플로>" -f confirm=deploy` → Environment 승인 | 사용자 요청 후, 승인은 사용자 |
| 예약 작업 (Functions) | zip 배포 `<래퍼> functionapp deployment source config-zip -g <RG> -n <함수앱> --src <zip> --subscription <구독>` | 사용자 요청 후 |
| DB 마이그레이션 | `psql "$PG_ADMIN_URI" --single-transaction -v ON_ERROR_STOP=1 -f <파일>` (URI 는 `~/.config/<프로젝트>/prod-db.env`) | 사용자 승인 후 |
| 앱 설정 변경 | `<래퍼> webapp config appsettings set -g <RG> -n <앱> --settings …` (비밀은 Key Vault 참조 문자열만) | 사용자 승인 후 |

## 8. AI 에이전트에게 맡길 때 붙일 지침 (복사용)

```
이 프로젝트의 Azure 작업은 낰낰컴퍼니 전용 계정에서만 한다. 이 맥의 기본 az 로그인(~/.azure)은 회사 계정이니 절대 쓰지 않는다.
- Azure CLI 는 <경로>/<약어>-az 래퍼로만 실행한다. 래퍼가 STOP 으로 막으면 우회하지 말고 나에게 보고한다.
- 변경은 --subscription 을 명시하고 rg-<프로젝트>-prod-krc 안에서만 한다. az login/logout/rest/ad, account set, --ids 는 쓰지 않는다.
- 로그인·MFA·포털 앱 등록은 내가 한다.
- 비밀값은 보거나 출력하지 않는다. Key Vault 에는 내가 직접 넣고, 앱 설정에는 Key Vault 참조로만 연결한다.
- 테넌트·구독 ID·계정 메일은 저장소·대화·로그에 쓰지 않는다. 필요하면 끝 4자리만.
- 리소스 생성·삭제, 설정 변경, 운영 DB 쓰기, 배포 승인은 내가 요청했을 때만 한다.
- 상세 규칙: 05-harness/templates/azure-account-isolation-guide.md (tester-match 저장소)
```

## 9. 실제로 겪은 함정

- **Environment 변수가 저장소 변수를 덮는다.** 저장소 변수만 바꿨다가 운영 결제창이 예전 PG 채널로 빌드됐다 (2026-10-08). 바꾼 뒤 실행 로그로 실제 값을 확인한다.
- **배포 성공 메시지 뒤 2~4분은 옛 컨테이너가 응답한다.** 새 경로·새 문구를 폴링해서 확인한다.
- **앱 설정을 바꾸면 App Service·Functions 가 재시작한다.** 재시작 중 보낸 수동 실행은 사라질 수 있다 (2026-10-09). 재시작 뒤 다시 실행한다.
- **Key Vault 참조가 안 풀리면 앱은 참조 문자열 자체를 값으로 받는다** (Azure 문서 동작). 웹훅·API 키가 조용히 실패하니, 비밀을 먼저 넣고 참조를 연결한 뒤 실제 기능을 한 번 돌려 본다.
- **비밀값을 바꾼 뒤엔 앱 설정 변경이나 재시작이 있어야 바로 반영된다.** 그 전까지는 캐시된 값을 쓴다 (Azure 문서상 최대 24시간).
- **래퍼가 `az rest`·`secret show` 를 막아서** 참조 해석 상태나 비밀값을 직접 볼 수 없다. 실제 기능 실행 결과(예: 응답의 `slackSent:true`, App Insights 로그)로 확인한다.
- **같은 체크아웃을 여러 세션이 함께 쓴다.** 다른 세션이 배포 중이면 별도 worktree 에서 작업한다.
