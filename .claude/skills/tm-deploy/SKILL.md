---
name: tm-deploy
description: Tester Match 표준 배포 — typecheck → test → build → wrangler deploy. 배포 요청("배포해줘", "deploy") 시 사용. cwd 사고·exit code 삼킴 방지 가드 포함.
---

# Tester Match 배포

## 절차 (순서 고정)

1. **DB 먼저**: 이번 세션에 `03-output/supabase/migrations/` 새 파일 있으면
   ```bash
   cd <repo>/03-output 에서 npx supabase db push
   ```
   출력에 `Applying migration ... Finished` 확인.

2. **빌드+배포** — 반드시 `03-output/app`에서, 단계별 성공 확인:
   ```bash
   cd <repo>/03-output/app
   npx tsc --noEmit          # 출력 없어야 통과
   npx vitest run            # "Tests N passed" 확인
   npx @cloudflare/next-on-pages   # "Build completed" 확인
   npx wrangler pages deploy .vercel/output/static --project-name tester-match --branch main
   ```

3. **커밋**: 배포 전 커밋+push (영어 메시지, 한글 메시지 배포 실패 이력). Co-Authored-By 트레일러 유지.

## ⚠️ 하드 가드

- **`| head`, `| tail`을 `&&` 체인 안에 쓰지 말 것** — 파이프가 exit code 삼켜서 빌드 실패해도 다음 단계 진행됨. 실사고: 잘못된 cwd에서 빌드 실패 → 이전 빌드 산출물이 배포됨. 필터 필요하면 단계를 분리하고 각 단계 성공을 출력으로 검증.
- 배포 직전 `pwd` = `.../03-output/app` 확인.
- `--force`, `--no-verify` 금지. 되돌리기는 `git revert`.
- 인증 만료 시(`wrangler` 401): 사용자에게 `npx wrangler login` 요청.

## 배포 후

- 프로덕션 https://tester-match.pages.dev 에서 변경 확인 요청 (프리뷰 URL 아님)
- RLS/DB 동반 변경이면 해당 기능 실제 1회 실행 확인 권고
- **세션 로그 갱신**: tm-session 스킬의 "세션 종료" 절차 수행 (WORKLOG.md 등)

상세·사고 이력: [DEPLOY.md](../../../DEPLOY.md)
