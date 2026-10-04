---
name: tm-deploy
description: Tester Match 표준 배포 — main 병합 → GitHub Actions "Deploy (Azure App Service)" 실행 → 사용자 승인 → 운영 확인. 배포 요청("배포해줘", "deploy") 시 사용. 2026-10-05 부터 운영은 Azure (Cloudflare Pages 배포는 방문자에게 안 보임).
---

# Tester Match 배포 (Azure App Service)

## 절차 (순서 고정)

1. **DB 먼저**: 이번 세션에 `03-output/supabase/migrations/` 새 파일이 있으면 `<repo>/03-output` 에서 `npx supabase db push` → `Applying migration ... Finished` 확인.

2. **로컬 검증** (`03-output/app`):
   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   ```
   새 라우트에 `export const runtime = "edge"` 를 넣지 않는다 (Node 런타임).

3. **main 반영**: 커밋(영어 메시지, Co-Authored-By 유지) → PR → CI 통과 → 병합. 공개 리포 — 비밀값·테넌트/구독 ID 커밋 금지.

4. **배포 실행**:
   ```bash
   gh workflow run deploy-azure.yml -R choirj91/tester-match --ref main -f confirm=deploy
   ```
   → 사용자에게 실행 URL 을 주고 **Review deployments → azure-prod → Approve and deploy** 요청 (배포 게이트). 끝날 때까지 `gh run watch <id> --exit-status` (백그라운드).

5. **운영 확인** (`https://tester-match.knockknock.company`, GET 만): 주요 공개 페이지 200, 로그인 필요 페이지 307, `/api/notifications` 비로그인 401. 재시작 직후 첫 요청은 수십 초 걸릴 수 있음.

## ⚠️ 하드 가드

- **로컬 서버의 `/api/cron/*` 에 어떤 요청도 보내지 않는다** — 로컬 `.env.local` 은 운영 DB (2026-10-04 사고).
- Azure 리소스·앱 설정·Key Vault 는 `05-harness/scripts/tm-az` 로만 (맨 `az` 금지 — 회사 Azure 계정 혼용 방지).
- 새 환경변수: 빌드 타임 `NEXT_PUBLIC_*` 는 GitHub `azure-prod` Variables, 비밀은 Key Vault + 앱 설정 참조 (DEPLOY.md 표).
- 리다이렉트·출처 비교에 `request.url` 의 origin 을 쓰지 말고 `publicOrigin()` (`lib/public-origin.ts`) 사용.
- `--force`, `--no-verify` 금지. 되돌리기는 이전 커밋 재배포 또는 `git revert`.

## 배포 후

- RLS/DB 동반 변경이면 해당 기능 실제 1회 실행 확인 권고
- **세션 로그 갱신**: tm-session 스킬의 "세션 종료" 절차 수행 (WORKLOG.md 등)

상세·사고 이력·롤백: [DEPLOY.md](../../../DEPLOY.md)
