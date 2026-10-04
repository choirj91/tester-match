# tester-match 정기 작업 (Azure Functions)

`.github/workflows/cron.yml` 의 7개 작업을 Azure Functions 타이머로 옮긴 것. 앱의 `/api/cron/*` 를 `Authorization: Bearer $CRON_SECRET` 으로 호출한다. 계획: `03-output/azure-migration/05-migration-plan.md` 1-5단계.

| 작업 | UTC (NCRONTAB) | KST | 반복 |
|---|---|---|---|
| checkin-reminder | `0 0 7 * * *` | 16:00 | — |
| penalty-sweep | `0 0 12 * * *` | 21:00 | more:true 까지 (최대 40) |
| validate-app-urls | `0 0 */6 * * *` | 6시간 | — |
| boost-expiry-sweep | `0 0 0 * * *` | 09:00 | — |
| weekly-hot-posts | `0 0 1 * * 1` | 월 10:00 | — |
| seat-reward-release | `0 15 */6 * * *` | 6시간 (:15) | more:true 까지 |
| paid-orders-report | `0 30 23 * * *` | 08:30 | 스윕 반복 후 리포트 (스윕 실패해도 리포트는 보냄) |

## 앱 설정

| 이름 | 값 |
|---|---|
| `APP_URL` | `https://tester-match.knockknock.company` (리다이렉트를 따라가지 않는다 — 정확한 호스트) |
| `CRON_SECRET` | Key Vault 참조 (앱과 같은 값) |
| `CRON_TIMERS_ENABLED` | `1` 일 때만 실제 호출. **GitHub `cron.yml` 을 끈 다음에** 켠다 — 같은 날 두 번 돌면 리마인더 메일이 중복된다 |

`host.json` 의 `functionTimeout` 은 1시간 — 반복 작업 최악 40회 × 60초 + 리포트 1회를 담는다 (Flex 기본 30분).

## 테스트

```bash
npm test
```

실제 앱을 부르지 않는다 (가짜 fetch). **로컬 앱 서버의 `/api/cron/*` 를 호출해 시험하지 않는다** — 로컬 env 는 운영 DB 를 가리킨다 (`04-review/history/2026-10-04-local-cron-penalty-incident.md`).
