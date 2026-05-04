# 2026-05-05 — 게시판 v1 + 앱 CRUD + 메뉴 통합 + 테스트 베이스라인

> 사용자 요청으로 한 세션에 대량 기능 묶음 처리. 추가 도메인(게시판), 도메인 CRUD 완성, 정보구조(메뉴), 테스트 인프라까지.

---

## 세션 요약

- **게시판 v1 도입** — ADR-0005 추가, posts/comments 테이블 + users_public_profile view + RLS 정책
- **앱 CRUD 완성** — 상세/수정/삭제(soft) 페이지 + PATCH/DELETE API
- **/browse** — 매칭 가능 앱 카드 리스트 + 상세 (다른 사용자 노출 화면)
- **/boost** — 서비스 준비중 placeholder
- **메뉴 통합** — `SiteHeader` 단일 컴포넌트로 모든 인증 페이지 + 랜딩 호환, 데스크톱·모바일 분리 nav
- **랜딩 소개 강화** — pain points 섹션 + FAQ + 인증 분기 CTA
- **테스트 베이스라인** — vitest 설정, validators 단위 테스트 + SiteHeader 컴포넌트 테스트, 25 tests passing

---

## 신규 / 수정 (총 30+ 파일)

### 결정·스키마

| 파일 | 내용 |
|---|---|
| 01-source/decisions/ADR-0005-board-v1.md | 게시판 v1 진입 결정 (v2 → v1 앞당김) |
| 03-output/supabase/migrations/20260504000005_board.sql | posts/comments + users_public_profile view + RLS |

### Validators (zod)

| 파일 |
|---|
| src/lib/validators/app.ts (`AppCreateSchema`, `AppUpdateSchema`) |
| src/lib/validators/post.ts (`PostCreateSchema`, `PostUpdateSchema`, `POST_CATEGORIES`) |
| src/lib/validators/comment.ts (`CommentCreateSchema`) |

### API (모두 edge runtime)

| 라우트 | 메서드 |
|---|---|
| /api/apps | POST (기존) |
| /api/apps/[id] | GET, PATCH, DELETE (soft) |
| /api/posts | GET (목록, 카테고리 필터), POST |
| /api/posts/[id] | GET (조회수 증가), PATCH, DELETE (soft) |
| /api/posts/[id]/comments | GET, POST |
| /api/comments/[id] | PATCH, DELETE (soft) |

### 페이지

| 라우트 | 역할 |
|---|---|
| / | 인증 분기 CTA, FAQ, pains 섹션 추가 |
| /apps | 본인 앱 목록 (기존) |
| /apps/new | 등록 폼 (기존) |
| /apps/[id] | 상세 + 수정/삭제 버튼 |
| /apps/[id]/edit | 수정 폼 (status 토글 포함) |
| /browse | 매칭 가능 앱 카드 리스트 |
| /browse/[id] | 앱 상세 + 참여 링크 |
| /boost | 서비스 준비중 |
| /board | 게시판 목록 + 카테고리 필터 |
| /board/new | 글 쓰기 |
| /board/[id] | 글 상세 + 댓글 + 본인 글 수정/삭제 |
| /board/[id]/edit | 글 수정 |

### 컴포넌트

| 파일 | 역할 |
|---|---|
| src/components/site-header.tsx | 메뉴 + 인증 분기 (데스크톱/모바일 nav) |
| src/app/apps/[id]/delete-app-button.tsx | 클라 컴포넌트, confirm + DELETE |
| src/app/apps/[id]/edit/edit-app-form.tsx | 수정 폼 (PATCH /api/apps/[id]) |
| src/app/board/new/post-form.tsx | 글 작성 폼 |
| src/app/board/[id]/post-actions.tsx | 본인 글 수정/삭제 버튼 |
| src/app/board/[id]/comment-list.tsx | 댓글 작성·표시·삭제 (낙관적 업데이트) |
| src/app/board/[id]/edit/edit-post-form.tsx | 글 수정 폼 |

### 테스트

| 파일 | 항목 수 |
|---|---|
| vitest.config.ts + vitest.setup.ts | 셋업 (jsdom, @testing-library/jest-dom) |
| src/lib/validators/app.test.ts | 10 |
| src/lib/validators/post.test.ts | 7 |
| src/lib/validators/comment.test.ts | 4 |
| src/components/site-header.test.tsx | 4 |
| **합계** | **25 passing** |

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| 게시판 v1 진입 | ADR-0005 작성 | 카카오 오픈채팅 대체. ERD 직접 수정 X. |
| 카테고리 enum | `자유/질문/공유/구인` 4종 | 단순. 리치 분류는 v2. |
| 댓글 구조 | 평면 (대댓글 X) | MVP 단순화. |
| 게시글/댓글 삭제 | soft delete (`deleted_at`) | 신고·감사용 보존. RLS는 `deleted_at is null` 필터. |
| view_count 증가 | 비차단 UPDATE (정확도 낮음 OK) | RPC 함수 추가 회피. |
| users_public_profile view | active 사용자 nickname/trust_score/role 노출 | 게시판/매칭 cross-user 표시 필요. 이메일·인증 정보 비노출. |
| 메뉴 모바일 | 별도 가로 스크롤 nav row | 햄버거 도입 회피. v1은 메뉴 4개라 충분. |
| 보일러플레이트 폼 | 클라이언트 fetch + zod 서버 검증 | Server Actions 도입 보류 (router.refresh 호출 패턴이 단순). |

---

## 검증

```bash
cd /Users/nakjun/app/choirj91-git/앱출시-테스터모집/tester-match/03-output
supabase db push   # 마이그레이션 #5 적용

cd app
pnpm typecheck    # ✓ pass
pnpm lint         # ✓ pass
pnpm test         # ✓ 25/25 pass
pnpm dev
```

### Happy paths

- [x] 랜딩 → 인증 분기 헤더 + FAQ 섹션
- [x] /apps/new → 등록 → /apps 카드 표시
- [x] /apps/[id] → 수정 → 저장 → 변경 반영
- [x] /apps/[id] → 삭제 → /apps 복귀, status='deleted' 라 카드에서 사라짐
- [x] /browse → 매칭중인 앱 카드 리스트
- [x] /board → 카테고리 필터 → 글 작성 → 상세 → 댓글
- [x] /boost → 서비스 준비중 화면

### RLS 회귀

- 다른 사용자 앱은 /apps 본인 목록에 미노출
- 게시판은 모든 인증 사용자 SELECT 가능, 본인 글만 PATCH/DELETE
- waitlist_signups 는 여전히 클라이언트 차단

---

## 미완료 / 후속

- [ ] F-APP-02 HEAD 검증 (cron 분리, Cloudflare Cron Triggers 진입 시점)
- [ ] 매칭 엔진 — 옵트인/완료 흐름 (matches 테이블 활용)
- [ ] 14일 체크인 (F-CHK-*)
- [ ] 결제 (F-PAY-*) — 토스페이먼츠
- [ ] 게시판: 멘션/알림/검색 (v2)
- [ ] 회원 탈퇴 (F-AUTH-04)
- [ ] /policies/terms, /policies/privacy 본문 작성
- [ ] CI에서 vitest 통과 확인 (push 후 GitHub Actions 검토)
