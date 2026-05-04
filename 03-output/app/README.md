# Tester Match — Web App

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4. Cloudflare Pages 호환.

## 빠른 시작

```bash
cd 03-output/app
pnpm install
cp .env.example .env.local   # 값 채우기
pnpm dev                     # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | Turbopack 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm typecheck` | TypeScript 타입 검사 |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest 단위 테스트 |
| `pnpm pages:build` | Cloudflare Pages 호환 빌드 (`@cloudflare/next-on-pages`) |
| `pnpm pages:dev` | Cloudflare 로컬 미리보기 (Wrangler) |
| `pnpm pages:deploy` | Cloudflare Pages 수동 배포 |

## 폴더 구조

```
src/
├── app/
│   ├── layout.tsx        루트 레이아웃 (Pretendard, 메타)
│   ├── page.tsx          Waitlist 랜딩
│   ├── globals.css       Tailwind 4 + 디자인 토큰
│   └── api/waitlist/     사전 등록 API (현재 stub)
├── components/           UI 컴포넌트
└── lib/
    ├── env.ts            환경 변수 검증 (zod)
    └── supabase/         Supabase SSR 클라이언트
```

## 코드 작성 규칙

- 모든 사용자향 텍스트는 **한국어** ([ADR-0001](../../01-source/decisions/ADR-0001-target-market.md)).
- API 라우트는 가능하면 `runtime = "edge"` (Cloudflare Pages 호환).
- 결제·환불 코드는 멱등성(idempotent) 검증 필수 ([CLAUDE.md](../../CLAUDE.md)).

## 다음 작업

[NEXT.md](../../NEXT.md) 참고.
