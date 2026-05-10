# 2026-05-05 — 맞리뷰 + 신뢰도 헤더 표시

> "맞팔로우"처럼 내 앱을 테스트해준 사용자 목록을 보고, 빠르게 상대방 앱도 테스트할 수 있는 기능. 이름 옆 신뢰도(★N) 표시 추가.

---

## 핵심 개념

| 용어 | 의미 |
|---|---|
| 맞리뷰 | 상대가 내 앱을 테스트했을 때, 나도 상대 앱을 테스트하는 행위 |
| 맞리뷰 가능 | 상대가 내 앱에 매칭돼 있고, 상대 앱이 matching/reviewing 상태이며, 내가 아직 참여 안 함 |
| 맞리뷰 완료 | 내가 상대 앱에 이미 matches 행이 존재하는 경우 |

---

## 신규 파일

| 파일 | 역할 |
|---|---|
| `app/my-reviews/page.tsx` | 맞리뷰 메인 페이지 (서버 컴포넌트) |

---

## 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `components/site-header.tsx` | NAV에 "맞리뷰" (/my-reviews) 추가 |
| `components/site-header.tsx` | 닉네임 옆 `★{trustScore}` 표시 (spark-500) |
| `components/site-header.test.tsx` | 맞리뷰 nav, 신뢰도 표시 테스트 추가 |

---

## 데이터 흐름 (5쿼리)

```
1. apps  WHERE owner_user_id = me               → 내 앱 ID 목록
2. matches WHERE app_id IN (내 앱) AND status IN (pending/active/completed)
           AND tester_user_id != me              → 내 앱 참여자 매칭 목록
3. users  WHERE id IN (테스터 ID들)             → 닉네임 + trust_score
4. apps   WHERE owner_user_id IN (테스터들)
           AND status IN (matching/reviewing)    → 테스터 보유 앱
5. matches WHERE tester_user_id = me
           AND app_id IN (테스터 앱 ID들)       → 내가 이미 참여한 테스터 앱
```

---

## UI 상태

| 조건 | 표시 |
|---|---|
| 내가 상대 앱에 이미 매칭 | "맞리뷰 완료 ✓" (mint 뱃지) |
| 상대 앱이 매칭 가능 | "맞리뷰 하기 →" (trust-600 버튼 → /browse/[app_id]) |
| 상대 앱 없음 / 모집 완료 | "상대방 앱 없음" / "모집 완료" (중립 텍스트) |
| 내 앱 없음 | 앱 등록 유도 빈 상태 |
| 참여자 없음 | 매칭 가능 앱 보기 유도 빈 상태 |

---

## 신뢰도 표시 (헤더)

```tsx
<Link href="/profile" className="hidden items-baseline gap-1.5 sm:inline-flex">
  <span className="text-sm text-neutral-500">{user.nickname}</span>
  <span className="text-[11px] font-semibold text-spark-500">★{user.trustScore}</span>
</Link>
```

trust_score 0~100 범위. TrustBadge 컴포넌트는 맞리뷰 페이지 내에서도 동일 색상 기준 사용:
- 80 이상: mint (우수)
- 50~79: trust (기본)
- 49 이하: neutral (주의)

---

## 검증

```
pnpm typecheck  ✓
pnpm test       ✓ 83/83 (site-header +2 tests)
```
