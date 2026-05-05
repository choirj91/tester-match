# ADR-0005: 게시판 v1 도입 — 카카오 오픈채팅 대체

- **상태**: Accepted (2026-05-04 잠금)
- **결정자**: nakjun
- **관련**: 01-source/spec/06_erd.md §5 (v2 예정 항목 → v1 진입), 03-output/supabase/migrations/20260504000005_board.sql

---

## Context

ERD §5는 `boards/posts/comments`를 v2 항목으로 분류했으나, 실제 운영에서 사용자는 카카오톡 오픈채팅방으로 정보 교환·매칭 보충 대화를 진행 중이었다. 웹 플랫폼 통합 단계에서 이 흐름을 옮겨오지 않으면:

1. 매칭 흐름과 별개의 외부 도구 의존 발생 (이탈·검색 누락)
2. 트러스트 스코어 / 신고 시스템과 단절
3. 사용자에게 "사이트 + 카톡방" 두 곳을 운영하라는 부담

### 후보

| 안 | 장점 | 단점 |
|---|---|---|
| A. 외부 카톡 오픈채팅 유지 | 즉시. 사용자 익숙. | 통합/검색/계정 연계 불가. PMF 측정 어려움. |
| B. **자체 게시판 v1 도입** | 단일 진입점. trust_score/신고와 자연 연결. | 스키마 1건 + 관리 책임. |
| C. Discord 임베드 | 채팅 UX 우수. | OAuth 추가 + 기록 검색 어려움. |

---

## Decision

**B. 자체 게시판 v1**. 단순한 카테고리·게시글·댓글 구조로 시작.

### 스코프 (v1)

- 카테고리: `자유` / `질문` / `공유` / `구인` (4종, enum)
- 게시글: 제목 + 본문(텍스트) + 카테고리. 첨부 파일 X (v2)
- 댓글: 평면 구조 (대댓글 X). markdown X (plain text)
- 본인 글/댓글만 수정·삭제(soft delete)
- 조회수 기록 (간단)

### 비-스코프 (v2 이후)

- 좋아요, 북마크
- 멘션 알림
- 마크다운 / 첨부 이미지
- 대댓글 (스레드)
- 신고 처리 (F-ADMIN-05 와 통합 시점)

---

## Consequences

### 스키마 추가
- `posts` (id, author_user_id, category, title, body, view_count, created_at, updated_at, deleted_at)
- `comments` (id, post_id, author_user_id, body, created_at, updated_at, deleted_at)
- `users_public_profile` view — 다른 사용자의 nickname/trust_score/role 노출용 (이메일·인증 정보는 미노출)

### RLS
- 게시글/댓글: 인증된 사용자 모두 SELECT (단 `deleted_at is null`), 본인만 INSERT/UPDATE/DELETE
- view 는 `grant select to authenticated`로 cross-user 프로필 조회 허용

### 기존 ERD 영향
- ERD §5 "boards, posts, comments — v2"는 본 ADR 로 무효. ERD 직접 수정 X.
- 04-review/history/2026-05-04-board-v1.md 에 변경 사유 기록.

### 운영
- 신고 누적 시 hide 처리는 admin SQL 직접 (F-ADMIN-05 진입 전)
- 콘텐츠 모더레이션은 사용자 행동 강령에 의존 (자동 필터 X)
