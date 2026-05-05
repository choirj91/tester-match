# 2026-05-05 — F-CHK-02 (1탭 체크인) + F-CRD-02 (완주 크레딧)

> 매칭 → 14일 체크인 → 완주 → 크레딧 적립의 핵심 루프 완성.

---

## 세션 요약

이전 세션의 자율 옵트인(F-MATCH-01)에 1탭 체크인 인증 + 자동 완주 + 800 크레딧 적립을 얹음. ERD `checkins`, `credits_ledger` 테이블 활용.

---

## 신규 / 수정

| 파일 | 역할 |
|---|---|
| lib/checkin.ts | `currentDayN()` — opted_in_at 기준 현재 day (1-14, 만료 시 0) |
| lib/checkin.test.ts | 6 tests (경계값: 0h/24h-1s/24h+1s/14일/만료/clock skew) |
| api/matches/[id]/checkins/route.ts | POST: 권한 검증 → day_n 계산 → checkins INSERT → 14일 시 status='completed' + 800 크레딧 적립 |
| my-tests/check-in-button.tsx | client: 오늘 체크인 / 완료 / 만료 분기 |
| my-tests/page.tsx | matches에 `checkins(id, day_n)` 조인 → 실제 체크인 일수 표시 (단순 day diff X) |
| apps/[id]/page.tsx | 각 테스터의 distinct 체크인 일수 + 미니 진행률 바 |

---

## 동작

### 옵트인 → 체크인 → 완주

1. `/browse/[id]` 옵트인 (이전 세션) → matches insert (status='active')
2. `/my-tests` 카드에 "오늘 체크인" 버튼
3. 클릭 → `POST /api/matches/[id]/checkins`
   - day_n = floor((now - opted_in_at) / 24h) + 1
   - day_n 1-14 범위 검증
   - INSERT checkins(match_id, day_n) — 부분 unique 로 같은 날 재체크인 차단
4. 14번째 체크인 시:
   - matches.status = 'completed', day_count = 14
   - credits_ledger INSERT (type='earn', amount=800, ref=match_id)
5. 14일 동안 매일 1번씩 누르면 끝.

### 표시

- **/my-tests**: 진행률 바가 실제 체크인 일수 / 14 비율 (이전: opted_in_at 단순 elapsed)
- **/apps/[id]**: 각 테스터 카드에 distinct 체크인 일수 + 미니 바

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| day_n 계산 단위 | 24h 윈도우 | KST/UTC 무관 단순. 옵트인 시각이 정확한 기준점. |
| 미체크인 날 따라잡기 | 불가 (현재 day_n 만 허용) | 부정 방지 (14일 후 한 번에 14번 체크인 차단). |
| 미완주 매칭 처리 | 명시적 만료 X (status='active' 유지) | F-CHK-06 페널티 sweep 진입 시 정리. |
| 완주 크레딧 적립 | 14번째 체크인 트랜잭션과 같은 핸들러 | 별도 cron 회피, 즉시 반영. |
| balance_after 계산 | 동기 SUM 후 += 800 | 완주는 비빈도 이벤트라 race 위험 낮음. |
| Supabase select 문자열 | 단일 문자열 (concat 금지) | 타입 인 ferrence 가 string concat 시 깨짐 — `GenericStringError` 발생. |

---

## 검증

```bash
pnpm typecheck   # ✓
pnpm lint        # ✓
pnpm test        # ✓ 40/40 (validators 30 + components 4 + checkin 6)
```

### Happy path (시나리오)

1. 사용자 B 가 사용자 A 의 앱 옵트인 → matches row, day_count=0, checkins 0개
2. /my-tests 카드: "체크인 0일 / 14일", "오늘 체크인" 버튼 활성
3. 체크인 클릭 → button "✓ 오늘 체크인 완료", 진행률 1/14
4. 다음 날 (24h+1s 경과) 다시 체크인 → 2/14
5. ... 14일째 체크인:
   - matches.status='completed'
   - credits_ledger 에 amount=800 row 1개
   - 카드 라벨 "완주" 표시

### Edge cases

- [x] 같은 날 두 번 클릭 → "오늘은 이미 체크인했습니다" (23505)
- [x] 14일 경과 후 첫 체크인 시도 → "체크인 가능 기간이 지났습니다" (day_n=0)
- [x] 본인 매칭 아닌 매칭에 체크인 시도 → 403
- [x] active 가 아닌 매칭 (opted_out, completed) → 409

---

## 미완료 / 후속

- [ ] F-CHK-01 일일 체크인 알림 이메일 (Resend) — 사용자가 체크인 까먹지 않게
- [ ] F-CHK-03 무작위 스크린샷 검증 (P1)
- [ ] F-CHK-06 5일 연속 미체크인 페널티 sweep (cron + status='penalized' + trust_score -10)
- [ ] /credits 페이지 — 잔액 + 적립/차감 내역 (현재 적립만 되고 사용자가 볼 곳 없음)
- [ ] F-CRD-04 환불 (충전 후 7일 미사용)
- [ ] F-MATCH-04 옵트아웃 시 자동 보충 매칭 알림
