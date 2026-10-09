# tester-match 정기 작업 (Azure Functions)

`.github/workflows/cron.yml` 의 7개 작업을 Azure Functions 타이머로 옮긴 것. **2026-10-05 운영 전환** — Function App `func-testermatch-cron-krc` (기존 B1 플랜 `asp-testermatch-prod-krc` 위, 추가 컴퓨트 비용 0), 템플릿 `../cron-function-app.json`. `cron.yml` 은 수동 실행 전용. 앱의 `/api/cron/*` 를 `Authorization: Bearer $CRON_SECRET` 으로 호출한다. 계획: `03-output/azure-migration/05-migration-plan.md` 1-5단계.

| 작업 | UTC (NCRONTAB) | KST | 반복 |
|---|---|---|---|
| checkin-reminder | `0 0 7 * * *` | 16:00 | — |
| penalty-sweep | `0 0 12 * * *` | 21:00 | more:true 까지 (최대 40) |
| validate-app-urls | `0 0 */6 * * *` | 6시간 | — |
| boost-expiry-sweep | `0 0 0 * * *` | 09:00 | — |
| weekly-hot-posts | `0 0 1 * * 1` | 월 10:00 | — |
| seat-reward-release | `0 15 */6 * * *` | 6시간 (:15) | more:true 까지 |
| paid-orders-report | `0 30 23 * * *` | 08:30 | 스윕 반복 후 리포트 (스윕 실패해도 리포트는 보냄) |
| weekly-report | `0 0 13 * * 5` | 금 22:00 | — (지난 금 22:00 → 이번 금 22:00 회원별 크레딧·신뢰도 증가, 관리자 메일·Slack) |

## 앱 설정

| 이름 | 값 |
|---|---|
| `APP_URL` | `https://tester-match.knockknock.company` (리다이렉트를 따라가지 않는다 — 정확한 호스트) |
| `CRON_SECRET` | Key Vault 참조 (앱과 같은 값) |
| `CRON_TIMERS_ENABLED` | `1` 일 때만 실제 호출. **GitHub `cron.yml` 을 끈 다음에** 켠다 — 같은 날 두 번 돌면 리마인더 메일이 중복된다 |
| `SLACK_OPS_WEBHOOK_URL` | Key Vault 참조 (선택). 있으면 작업 실행마다 결과 한 줄을 Slack 으로 보낸다 — 응답의 숫자·참거짓·배열 길이만, 문자열은 오류 `message` 만. 비어 있으면 보내지 않는다 |
| `CRON_SLACK_MODE` | `all`(기본) 또는 `failures` — 실패한 실행만 받으려면 `failures` |

`host.json` 의 `functionTimeout` 은 1시간 — 반복 작업 최악 40회 × 60초 + 리포트 1회를 담는다.

## 배포·운영

```bash
npm ci --omit=dev && zip -qr /tmp/cron-func.zip host.json package.json src node_modules
tm-az functionapp deployment source config-zip -g rg-testermatch-prod-krc -n func-testermatch-cron-krc --subscription <sub> --src /tmp/cron-func.zip --timeout 600
```

- 수동 실행: `POST https://func-testermatch-cron-krc.azurewebsites.net/admin/functions/<이름>` + `x-functions-key: <masterKey>` (`tm-az functionapp keys list`). 응답 202, 결과는 로그
- 로그: 앱 설정 `AzureFunctionsJobHost__logging__fileLoggingMode=always` → `tm-az webapp log download` 의 `LogFiles/Application/Functions/Function/<이름>/`
- 설정 변경 후 새 컨테이너가 뜨기까지 1~3분 동안 **옛 프로세스가 옛 설정으로 계속 응답**한다 — `/admin/host/status` 의 `processUptime` 이 줄어든 뒤 시험한다
- 메일 발송 한도(ACS 기본 시간당 100통) — 리마인더는 수신자 1명당 1통 (2026-10-05 기준 21통)

## 테스트

```bash
npm test
```

실제 앱을 부르지 않는다 (가짜 fetch). **로컬 앱 서버의 `/api/cron/*` 를 호출해 시험하지 않는다** — 로컬 env 는 운영 DB 를 가리킨다 (`04-review/history/2026-10-04-local-cron-penalty-incident.md`).
