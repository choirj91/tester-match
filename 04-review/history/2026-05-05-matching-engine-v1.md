# 2026-05-05 — F-MATCH-01 매칭 엔진 v1 (수동 옵트인)

> PR #1 머지 후 새 브랜치 `feat/matching` 시작. 매칭 엔진의 첫 슬라이스 — 알고리즘 자동 매칭이 아니라 **테스터 자율 옵트인** 흐름.

---

## 세션 요약

지금까지 만든 인프라 위에 핵심 가치(테스터 ↔ 앱 매칭) 흐름을 얹음. F-MATCH-03(가중치 알고리즘)은 보류, 사용자가 `/browse`에서 직접 앱을 골라 참여하는 자율 매칭으로 시작. 14일 카운트는 클라이언트에서 `opted_in_at` 기준 단순 계산 (체크인 시스템 F-CHK-* 진입 전).

---

## 신규 / 수정

| 파일 | 역할 |
|---|---|
| validators/match.ts | `MatchOptInSchema` (app_id), `MatchOptOutSchema` (선택 사유) |
| api/matches/route.ts | POST: 옵트인 — 앱 상태/본인 차단/정원 검증 → matches insert + required_testers 감소 |
| api/matches/[id]/route.ts | PATCH: 본인 active 매칭 → opted_out + required_testers 복구 |
| my-tests/page.tsx | 본인 참여중 매칭 카드 (14일 진행률 바 + 안드로이드/웹 링크 + 옵트아웃 버튼) |
| my-tests/opt-out-button.tsx | 옵트아웃 client (사유 prompt 후 PATCH) |
| browse/[id]/page.tsx | 기존 + `existingMatch` 조회 + `<OptInButton>` 컨디션 표시 |
| browse/[id]/opt-in-button.tsx | 옵트인 client (본인앱/정원/중복 분기 처리) |
| apps/[id]/page.tsx | 참여중인 테스터 리스트 + 진행중/완주 카운트 추가 |
| components/site-header.tsx | "내 테스트" 메뉴 추가 (5번째 항목) |
| validators/match.test.ts | 9 tests (옵트인 강제 정수, 사유 길이 등) |

---

## 동작 흐름

### 옵트인
1. `/browse` → 앱 카드 클릭 → `/browse/[id]`
2. "이 앱 테스트에 참여하기" 버튼
   - 본인 앱이면 비활성 + "본인 앱에는 참여할 수 없습니다"
   - 이미 참여중이면 "이미 참여중 — 내 테스트에서 확인"
   - 정원 마감이면 "정원 마감"
3. POST `/api/matches { app_id }` → matches insert (status=active) + apps.required_testers -1
4. 성공 시 `/my-tests` 로 이동

### 진행 표시
- `opted_in_at` 부터 일수 계산 (단순 day diff, KST 무관)
- 14일 진행률 바 + N일차 / 14일 표시

### 옵트아웃
1. `/my-tests` → 카드의 "옵트아웃" 버튼
2. prompt 로 사유 입력(선택)
3. PATCH `/api/matches/[id]` → status='opted_out' + required_testers +1

### 개발자 시점 (`/apps/[id]`)
- 참여중인 테스터 리스트 (닉네임, 신뢰점수, N일차)
- 진행중/완주 카운트 표시

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| 알고리즘 자동 매칭 | 보류 (F-MATCH-03) | 자율 옵트인이 단순·검증 가능. 자동화는 PMF 후. |
| 매칭 status flow | 직접 'active' (pending 생략) | 자율 옵트인은 '대기' 단계 불필요. 알고리즘 매칭 도입 시 'pending' 활성. |
| required_testers 동시성 | 앱 레벨 검증만 (DB 락 X) | MVP 수준. 12명 정원 race window 매우 작음. RPC 트랜잭션은 후속. |
| credit_payout 기본값 | 800 (DB default) | ADR-0003 그대로. F-CRD-02 완주 시 자동 적립은 14일 체크인 후. |
| 14일 day count | `opted_in_at` 부터 단순 day diff | 정확한 KST/체크인 기록은 F-CHK-* 진입 시 정교화. |

---

## 검증

```bash
cd /Users/nakjun/app/choirj91-git/앱출시-테스터모집/tester-match/03-output/app
pnpm typecheck   # ✓
pnpm lint        # ✓
pnpm test        # ✓ 34/34 (validators 30 + components 4)
pnpm dev
```

### Happy path

1. 사용자 A 가 앱 등록 → status='matching', required_testers=12
2. 사용자 B 로그인 → /browse 에서 A의 앱 카드 보임 → 클릭
3. /browse/[id] → "이 앱 테스트에 참여하기" 클릭
4. /my-tests 로 이동 → 카드 1장 (1일차 / 14일 진행률 바)
5. 사용자 A 가 /apps/[id] 접속 → 참여중인 테스터: B
6. apps.required_testers = 11 로 감소 확인

### Edge cases

- [x] 본인 앱 옵트인 차단 (UI + API 양측)
- [x] 동일 앱 중복 옵트인 차단 (matches 부분 unique index)
- [x] 정원 마감(required_testers=0) 시 버튼 비활성
- [x] 옵트아웃 후 required_testers 복구

---

## 미완료 / 후속

- [ ] F-MATCH-03 가중치 알고리즘 (Trust Score + 카테고리 + 타임존)
- [ ] F-MATCH-04 자동 보충 매칭 (옵트아웃 시 다음 후보 알림)
- [ ] F-MATCH-06 알림 발송 (이메일 + Discord 웹훅)
- [ ] F-CHK-01 일일 체크인 알림 + F-CHK-02 1탭 체크인 인증
- [ ] F-CRD-02 완주 시 800 크레딧 자동 적립 (14일 + 체크인 통과 시)
- [ ] required_testers 동시성 RPC 트랜잭션 (정원 race 완전 차단)
- [ ] 매칭 화면에서 다른 테스터 nickname/trust_score 노출은 RLS 우회 admin client 로 작동 중. 클라이언트 사이드 쿼리 도입 시 users_public_profile view 권한 재검토.
