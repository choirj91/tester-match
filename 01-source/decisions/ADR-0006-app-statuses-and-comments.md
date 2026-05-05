# ADR-0006: 앱 상태 라이프사이클 확장 + 앱 댓글(품앗이) 도입

- **상태**: Accepted (2026-05-05 잠금)
- **결정자**: nakjun
- **관련**: 01-source/spec/06_erd.md §2.3, 03-output/supabase/migrations/20260505000001_app_statuses_and_comments.sql

---

## Context

운영 데이터에 따라 사용자 두 가지 요구가 명확:

1. **앱 상태가 "모집중"만으로는 부족**: 12명을 모은 뒤 Google Play 심사 / 정식 출시까지의 상태가 노출되지 않음. 테스터는 이미 출시된 앱인지, 모집중인지 한눈에 못 봄.
2. **품앗이 대화가 필요**: 매칭 후 카톡으로 "내 앱도 부탁해요" 라고 주고받던 흐름을 웹 안에 두고 싶음. 게시판은 너무 무겁고, 매칭 화면 즉시 댓글이 자연스러움.

또한:
3. **참여 링크는 참여 후에만 공개**: 참여 의사 없이 링크만 가져가는 행위 차단.
4. **표시 항목 정리**: "남은 테스터 N명" → "N명 참여중" (의미 명확화), 등록자 신뢰점수 → 앱 상태로 교체.

---

## Decision

### 1) 앱 상태 enum 확장

기존 `apps.status`: `draft / matching / completed / paused / deleted`

→ 변경:

| 신규 값 | 한국어 라벨 | 의미 |
|---|---|---|
| `matching` | 모집중 | 12명 테스터 모집 중 (기본 상태) |
| `reviewing` | 심사중 | 모집 완료, Google Play 심사 단계 |
| `launched` | 출시 완료 | 정식 출시됨 |
| `paused` | 일시정지 | dev 명시적 일시 중단 |
| `deleted` | 삭제됨 | soft delete |

`completed` 는 호환 유지(레거시) 하되 UI 라벨은 "심사중" 으로 통합.

### 2) `app_comments` 테이블 신설

- `id, app_id (fk), author_user_id (fk), body, promoted_app_id (fk apps NULL), created_at, updated_at, deleted_at`
- 댓글 본문 1~1000 chars
- `promoted_app_id`: 작성자가 자기 앱 1개를 첨부 가능 (cross-promotion)
- soft delete via `deleted_at`
- RLS: 인증 사용자 모두 SELECT (`deleted_at is null`), 본인만 INSERT/UPDATE

게시판(`posts/comments`)와 분리: posts 는 자유 게시판, app_comments 는 앱 매칭 화면 컨텍스트 한정.

### 3) `/browse/[id]` 인비테이션 게이팅

- 비-참여자: 안드로이드/웹 링크 모두 가림 → "참여 후 공개" 안내
- 참여자: 두 링크 공개

DB 변경 없음. 페이지 단에서 `existingMatch` 유무로 분기.

### 4) `/browse` 정렬

- default: 상태순 (`matching → reviewing → launched`) + created_at desc
- 옵션: 최신순(created_at desc) / 참여 많은 순(active match count desc)
- URL param `?sort=status|newest|popular`

---

## Consequences

### 스키마
- ALTER `apps_status_check` constraint 갱신 (`reviewing`, `launched` 추가)
- CREATE `app_comments` + RLS

### 코드
- `lib/app-status.ts` — STATUS_LABEL/ORDER 중앙화
- `validators/app.ts` — AppUpdateSchema status enum 확장
- `validators/app-comment.ts` — 신규
- `/api/apps/[id]/comments` GET/POST + `/api/app-comments/[id]` PATCH/DELETE
- `/browse/[id]` 게이팅 + 댓글 섹션 + 상태/카운트 표시
- `/browse` 정렬 + 카운트 + 상태 배지
- `/apps/[id]/edit` 상태 select 옵션 확장

### ERD §2.3
- `category` 이미 nullable 처리됨(ADR-0004 후속). 본 변경은 status check 만.
- ERD 텍스트 직접 수정 X. 본 ADR 로 무효 명시.

### 정책 영향
- 정책 페이지(`/policies/*`)는 영향 없음 (앱 상태는 약관에서 별개로 다루지 않음).

### 정렬 비-스코프
- 카테고리/타임존 필터링은 v1 미포함 (F-MATCH-03 가중치 알고리즘과 함께 추후).

---

## 마이그레이션 순서

1. apply migration #6 (status check 확장 + app_comments)
2. 코드 배포 (페이지 분기 + 새 라벨)
3. 사용자 액션: 기존 'matching' 앱 중 출시 직전인 것은 dev 이 명시적으로 'reviewing' / 'launched' 로 전환

기존 데이터 자동 마이그레이션 X — 라벨만 변경되어 'completed' 행 있다면 "심사중" 으로 표시.
