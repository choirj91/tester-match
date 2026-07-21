# DEPLOY — 배포 절차 (실전 CLI)

> 대시보드 초기 설정은 [03-output/infra/cloudflare-pages.md](03-output/infra/cloudflare-pages.md).
> 이 문서는 **평소 배포에 실제로 쓰는 CLI 절차**.

## 표준 배포 (원커맨드)

```bash
cd /Users/nakjun/app/choirj91-git/앱출시-테스터모집/tester-match/03-output/app \
  && npx tsc --noEmit \
  && npx vitest run \
  && npx @cloudflare/next-on-pages \
  && npx wrangler pages deploy .vercel/output/static --project-name tester-match --branch main
```

성공 시 `✨ Deployment complete!` + 프리뷰 URL. 프로덕션: https://tester-match.pages.dev

## DB 마이그레이션 (코드 배포 전에)

```bash
cd /Users/nakjun/app/choirj91-git/앱출시-테스터모집/tester-match/03-output
npx supabase db push
```

- 마이그레이션 파일: `03-output/supabase/migrations/YYYYMMDDHHMMSS_name.sql`
- **순서 중요**: 스키마 바뀌는 코드는 마이그레이션 먼저 push → 코드 배포

## 커밋 규칙

- 커밋 메시지 **영어** (한글 메시지로 wrangler 배포 실패 이력)
- `--force`, `--no-verify` 금지 (CLAUDE.md 절대 금지)
- 되돌릴 땐 `git revert` (AdSense 리버트 사례)

## ⚠️ 사고 이력 (반복 금지)

| 사고 | 원인 | 예방 |
|---|---|---|
| 이전 빌드가 배포됨 | 잘못된 cwd에서 빌드 실패 → 파이프 exit 0 → 옛 `.vercel/output` 배포 | 배포 전 `pwd` 확인 = `03-output/app`. 빌드 로그에 `Build completed` 확인 후 deploy |
| wrangler 인증 만료 | 장기 미사용 | `npx wrangler login` 재로그인 |
| 게시판 전체 소실 (PGRST201) | 조인 테이블 추가로 임베드 모호 | 두 테이블 다 참조하는 테이블 추가 시 기존 임베드 전수 점검, FK 힌트(`!posts_author_user_id_fkey`) 사용 |
| 조회수 미집계 | 로직이 미사용 API에만 존재 | 서버 컴포넌트 렌더 경로에서 실제 호출되는지 확인 |

## 환경 변수 (Cloudflare Pages → Settings → Environment variables)

| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 admin client |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Directory API (Workspace 그룹 자동 가입) |
| `GOOGLE_ADMIN_EMAIL` | domain-wide delegation 대상 관리자 |
| `TESTER_GROUP_EMAIL` | 내부 그룹 (기본 testers@knockknock.company) |
| `RESEND_API_KEY` | 이메일 발송 |

값 변경 후 **재배포해야 반영** (빌드 타임 주입).

## 브랜치 전략

- `main` = 프로덕션. 직접 커밋 + 배포
- `feat/adsense-placements` = 광고 배치 보존 (AdSense 승인 시 병합)
- 실험적 작업은 `feat/*` 브랜치 → 검증 후 main 병합

## 배포 후 확인 체크리스트

1. 프로덕션 URL 열어서 변경 화면 직접 확인 (프리뷰 URL 아님 — 캐시 주의)
2. 로그인 필요한 기능이면 로그인 상태로 확인
3. DB 변경 동반 시 해당 기능 1회 실제 실행 (RLS 오류는 배포 후에만 드러남)
