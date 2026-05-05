# 2026-05-05 — 앱 상태 라이프사이클 + 앱 댓글 (ADR-0006)

> 사용자 운영 피드백 반영. 매칭 화면이 단순 "모집중/완료"를 넘어 출시 라이프사이클 전반을 표현하고, 카톡 오픈채팅에서 일어나던 품앗이 대화를 화면 내로 흡수.

---

## 핵심 변경 요약

1. **앱 상태 enum 확장**: `matching(모집중) → reviewing(심사중) → launched(출시 완료)` 라이프사이클.
2. **참여 링크 게이팅**: `/browse/[id]` 에서 안드로이드/웹 초대 링크는 옵트인(또는 본인 앱) 후에만 공개.
3. **앱 댓글 + 내 앱 링크 첨부**: 매칭 화면 하단 댓글, 작성 시 내 앱 1개를 자동 promo card 로 부착.
4. **표시 정리**: "남은 테스터" → "N명 참여중", 등록자 신뢰점수 → 앱 상태 배지.
5. **`/browse` 정렬**: 상태순(default) / 최신순 / 참여 많은 순.

---

## 신규 / 수정

### 결정·스키마

| 파일 | 내용 |
|---|---|
| 01-source/decisions/ADR-0006-app-statuses-and-comments.md | 상태 확장 + app_comments + 게이팅 + 정렬 결정 |
| 03-output/supabase/migrations/20260505000001_app_statuses_and_comments.sql | apps_status_check 갱신 + app_comments 테이블 + RLS |

### 공유 헬퍼

| 파일 | 역할 |
|---|---|
| src/lib/app-status.ts | `APP_STATUS_LABEL`, `APP_STATUS_ORDER`, `BROWSE_STATUSES`, `EDITABLE_APP_STATUSES` 중앙화 |
| src/lib/validators/app.ts | `AppUpdateSchema.status` enum 확장 (matching/reviewing/launched/paused) |
| src/lib/validators/app-comment.ts | `AppCommentCreateSchema` (body 1-1000 + promoted_app_id 선택) |
| src/lib/validators/app-comment.test.ts | 9 tests |

### API

| 라우트 | 메서드 |
|---|---|
| /api/apps/[id]/comments | GET / POST (promoted_app_id 본인 소유 + 자기 자신 첨부 차단 검증) |
| /api/app-comments/[id] | PATCH (body) / DELETE (soft) |

### 페이지

| 파일 | 변경 |
|---|---|
| /browse/page.tsx | BROWSE_STATUSES 필터, 정렬 nav, 앱별 active match count, 상태 배지 |
| /browse/[id]/page.tsx | 링크 게이팅 (joined or owner), Stat 갱신("참여중"/"상태"), 댓글 섹션 통합, promoted_app 이름 매핑 |
| /browse/[id]/comments-section.tsx (신규) | client. 댓글 작성·삭제 + "내 앱 링크 걸기" picker |
| /apps/page.tsx | required_testers → "N명 참여중" 표시, 상태 라벨 일괄 교체 |
| /apps/[id]/page.tsx | 상태 배지, Stat 순서 재배치 |
| /apps/[id]/edit/edit-app-form.tsx | 상태 select 신규 enum 반영 (모집중/심사중/출시 완료/일시정지) |
| /apps/new/app-form.tsx | "현재 남은 테스터 수" → "목표 테스터 수" 라벨/힌트 갱신 |

---

## 정렬 동작

URL: `/browse?sort=<key>`

| sort | 정렬 |
|---|---|
| `status` (default) | BOOST 우선 → 모집중 → 심사중 → 출시 완료 → 그 안에서 최신순 |
| `newest` | created_at desc |
| `popular` | active match count desc |

---

## 검증

```bash
pnpm typecheck   # ✓
pnpm lint        # ✓
pnpm test        # ✓ 63/63 (validators 39 + components 4 + checkin 6 + email 3 + cron 3 + credits 3 + match 9 + profile 4 + post 7 + comment 4 + app 10)
```

### 시나리오

1. 사용자 A 가 앱 등록 → 상태 모집중 → `/browse` 카드 "0명 참여중" + 모집중 배지
2. 사용자 B 가 `/browse/[A의 앱]` 진입 → 링크 가려짐 → "참여하기" 클릭 → 링크 공개
3. `/browse` 다시 보면 "1명 참여중"
4. B 가 댓글 "저도 잘 부탁드려요" + "내 앱 링크 걸기" 본인 앱 선택 → 등록
5. A 가 같은 페이지 가면 댓글 + 첨부 앱 카드 → 클릭 시 B의 앱으로 이동
6. A 가 12명 모은 후 `/apps/[id]/edit` 에서 상태 "심사중" 으로 변경
7. `/browse` 정렬 "참여 많은 순" → A의 앱이 상위
8. Google Play 출시 후 "출시 완료" 로 변경

### Edge cases

- [x] 본인 앱 페이지에서는 링크 즉시 공개 (`isOwn` 분기)
- [x] 본인 앱 첨부 picker 가 없으면 (모두 deleted/paused) 비활성
- [x] 자기 자신을 promoted_app 으로 지정 차단 (API)
- [x] 다른 사람 앱을 promoted_app 으로 지정 차단 (API: owner_user_id 검증)
- [x] 'completed' 레거시 상태 → "심사중" 으로 라벨 표시

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| 'completed' 처리 | enum 유지 + 라벨 "심사중" | 기존 데이터 마이그레이션 부담 회피 |
| 링크 게이팅 범위 | 안드로이드 + 웹 모두 | 사용자 의도 (참여 의지 확인 후 공개) |
| 댓글 테이블 분리 | app_comments 신규 | posts/comments(게시판)와 컨텍스트 분리, FK 단순 |
| promoted_app 검증 | 앱 레벨 (owner+status+self-ref) | DB CHECK constraint 부담 없이 명시적 |
| 카운트 계산 | 앱 list 후 별도 matches 쿼리 한 번 | view/trigger 추가 회피, MVP 충분 |
| 정렬 | 클라이언트(서버) 정렬 | 100건 한도 작아 충분, BOOST 우선 적용도 단순 |

---

## 미완료 / 후속

- [ ] 댓글 좋아요/대댓글 (게시판과 동일하게 v2)
- [ ] 댓글 알림 (앱 등록자에게 새 댓글 이메일)
- [ ] 매칭 정원 도달 시 자동 'reviewing' 전환 옵션 (현재 dev 명시적)
- [ ] 카테고리·타임존 필터 (정렬과 별개)
- [ ] /browse '출시 완료' 앱은 별도 섹션 분리 검토 (모집중과 한 리스트 vs 분리)
