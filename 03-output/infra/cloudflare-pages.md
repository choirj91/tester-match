# Cloudflare Pages 배포 가이드

> [ADR-0002](../../01-source/decisions/ADR-0002-hosting.md): Cloudflare Pages + Supabase 채택 (Vercel 비채택).

## 1. 사전 준비

- Cloudflare 계정 (도메인 등록 또는 외부 도메인 NS 위임)
- GitHub 레포에 `03-output/app/` 푸시 완료
- Supabase 프로젝트 생성 후 `NEXT_PUBLIC_SUPABASE_URL`, `_ANON_KEY`, `SERVICE_ROLE_KEY` 확보

## 2. 프로젝트 연결 (Dashboard)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub 레포 선택 → 브랜치 `main`
3. **Build settings**

| 항목 | 값 |
|---|---|
| Framework preset | **Next.js** |
| Build command | `pnpm install --frozen-lockfile && pnpm pages:build` |
| Build output directory | `.vercel/output/static` |
| Root directory | `03-output/app` |
| Node version | `20.11.0` 이상 |

> 스크립트는 [package.json](../app/package.json) 참고. `pages:build`가 `@cloudflare/next-on-pages`를 호출.

## 3. 환경 변수 (Production)

Cloudflare Pages → 프로젝트 → **Settings** → **Environment variables**:

```
NEXT_PUBLIC_SUPABASE_URL              = https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  = sb_publishable_...
SUPABASE_SECRET_KEY                   = sb_secret_...          ← Encrypt 체크
NEXT_PUBLIC_APP_URL               = https://testermatch.com
NEXT_PUBLIC_APP_NAME              = Tester Match
RESEND_API_KEY                    = re_...                  ← Encrypt
BREVO_API_KEY                     = xkeysib-...             ← Encrypt
TOSS_CLIENT_KEY                   = live_ck_...
TOSS_SECRET_KEY                   = live_sk_...             ← Encrypt
AUTH_SECRET                       = <openssl rand -base64 32>  ← Encrypt
AUTH_GOOGLE_CLIENT_ID             = ...
AUTH_GOOGLE_CLIENT_SECRET         = ...                     ← Encrypt
```

> Preview 환경(PR 빌드)은 **테스트 키만** 입력. 프로덕션 키 노출 금지.

## 4. 호환성 주의사항

| 항목 | 처리 |
|---|---|
| Edge Runtime 강제 | API 라우트에 `export const runtime = "edge"` 명시 |
| Node native API | `sharp`, `bcrypt` 등 사용 금지 (WASM 또는 외부 함수 호출) |
| Bundle 25MB 제한 | 큰 파일은 Cloudflare R2 / Supabase Storage 사용 |
| Function CPU 30초 | 14일 체크인 등 무거운 작업은 Cron Triggers로 분리 |

## 5. 도메인 연결

1. Cloudflare Pages → **Custom domains** → `testermatch.com` 추가
2. Cloudflare DNS는 자동 설정 (외부 NS면 CNAME 추가 안내)
3. SSL은 Cloudflare 자동 발급
4. `www`는 301 리다이렉트로 root로 통합 권장

## 6. Supabase 일시정지 방지

Free 프로젝트는 **1주 비활성 시 자동 정지**. 다음 중 하나:

- **권장**: UptimeRobot 무료 계정 → `https://testermatch.com/api/health` 5분 간격 ping
- 또는 Cloudflare Cron Triggers로 6시간마다 `select 1` 호출
- 매출 발생 시 Supabase Pro $25/월 즉시 전환

## 7. 미해결 항목

- [ ] `@cloudflare/next-on-pages` Tailwind 4 베타 호환성 검증 (Week 2 우선 작업)
- [ ] Preview 배포용 Supabase 별도 프로젝트 분리 vs Local 공유
- [ ] Wrangler를 통한 수동 배포 백업 절차 문서화
