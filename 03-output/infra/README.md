# Infra

배포·운영 관련 설정과 가이드.

| 파일 | 내용 |
|---|---|
| [cloudflare-pages.md](cloudflare-pages.md) | Cloudflare Pages 배포 절차 + 환경 변수 + 호환성 주의 |
| [supabase-auth-setup.md](supabase-auth-setup.md) | Google OAuth Client 생성 → Supabase Provider 활성화 → 검증 절차 |

## 추가 예정

- `supabase-prod.md` — 운영 프로젝트 셋업, 백업, Pro 전환 시점
- `cron-triggers.md` — 14일 체크인·SLA·일시정지 방지 cron 설계
- `monitoring.md` — Sentry/PostHog/UptimeRobot 셋업
- `incident-runbook.md` — DB 다운, 결제 실패, 메일 한도 초과 대응
