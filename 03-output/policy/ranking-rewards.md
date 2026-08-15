# 월간 랭킹 크레딧 보상 — v1 (시행)

> 상태: **승인·시행** (2026-08-15 사용자 승인: 예산 6,000/월 · 첫 대상 2026-09월분 · 신뢰도 체크인 소급 동시 시행)
> 코드 단일 소스: `03-output/app/src/lib/ranking-rewards.ts`
> 관련: [ADR-0003 크레딧 모델](../../01-source/decisions/ADR-0003-credit-model.md) · [ADR-0010 신뢰도 정책](../../01-source/decisions/ADR-0010-trust-score-policy.md) · [trust-score.md](trust-score.md)
> 배경: `/stats` 배너로 "랭킹·완주 실적 크레딧 보상" 예고함 (2026-07-24). 약속 이행 건.

## 1. 원칙

1. **완주 중심** — 보상 지표는 "월간 14일 완주 수". 체크인 수·신뢰도 점수 자체는 지표로 쓰지 않는다.
   - 이유: 신뢰도는 `매치 수 × 일일 체크인`으로 인플레 (실사례: 3주 +209점). 완주는 14일 실제 유지가 필요해 어뷰징 비용이 가장 높음
   - 체크인은 이미 신뢰도 +1로, 완주는 이미 800 크레딧/매치로 보상 중 — 랭킹 보상은 **추가 인센티브 소액**
2. **잠금 결정 #3 준수** — 1크레딧 = 1원 부채 인식. 월 예산 상한 고정, 남발 금지
3. **Google Play 정책 안전** — 테스트 참여·완주 보상은 서비스 본질 (리뷰·별점 연동 아님, F-RVW-* 무관)
4. **멱등 지급** — 월+유저 unique 가드, 재실행 안전

## 2. 보상 테이블 (월간, KST 달력 월)

| 순위 | 보상 | 자격 |
|---|---|---|
| 1위 | 3,000 크레딧 | 당월 완주 ≥ 2 |
| 2위 | 2,000 크레딧 | 당월 완주 ≥ 1 |
| 3위 | 1,000 크레딧 | 당월 완주 ≥ 1 |

- 월 예산 상한: **6,000 크레딧** (수상자 미달 시 미지급분 이월 없음)
- 동점 처리: 완주 수 → 신뢰도 → 먼저 완주 달성한 순
- 제외: 신뢰도 50 미만(페널티 −10이 반영되므로 간접 차단), 탈퇴·정지 계정
- 자기 소유 앱에 대한 완주(부계정 의심)는 집계 제외

## 3. 지급 방식 — 자동 (크론) + 수동 백업

- **자동**: GitHub Actions 크론 — 매월 1~3일 KST 09:30, `/api/cron/monthly-ranking-rewards`
  호출 (3일 연속 = 재시도, 멱등이라 안전)
- **수동 백업**: `/admin/ranking-rewards` — 미리보기·크론 실패 시 재실행·지급 내역 확인
- 지급 = `ranking_rewards` insert (unique(reward_month, user_id) 멱등 가드) +
  `credits_ledger` insert (type `earn`, ref_type `ranking_reward`) + 수상 알림
- 공용 로직: `grantMonthlyRewards()` (`lib/ranking-rewards.ts`) — 크론·관리자 버튼 동일 코드

## 4. 표시

- `/stats`: 기존 예고 배너 → **"이번 달 완주 랭킹"** 섹션 교체 (당월 완주 수 TOP 10 + 보상 안내 + 자격 조건)
- 지난달 수상자 명단 (지급 후 표시)
- 수상자에게 알림 (notifications, 기존 타입 재사용 또는 `reward_granted` 추가)

## 5. 스키마

```sql
create table public.ranking_rewards (
  id            bigint generated always as identity primary key,
  reward_month  date   not null,            -- 해당 월 1일 (KST)
  user_id       bigint not null references public.users(id) on delete cascade,
  rank          int    not null check (rank between 1 and 3),
  completed     int    not null,            -- 당월 완주 수 (지급 시점 스냅샷)
  amount        int    not null check (amount > 0),
  granted_by    bigint references public.users(id),
  created_at    timestamptz not null default now(),
  unique (reward_month, user_id),
  unique (reward_month, rank)
);
```

완주 판정: `matches.status = 'completed'` 이고 완주 확정 시각(14일차 체크인 `checked_in_at`)이 당월(KST) 내.

## 6. 확정 사항 (2026-08-15 승인)

- 보상 규모: **6,000/월** (3,000 / 2,000 / 1,000)
- 첫 집계 대상: **2026-09월분** (지급 10월 초). 8월 잔여 기간은 예고 표시
- 신뢰도 체크인 소급: **동시 시행** — 시행일(07-24) 이전 체크인당 +1을
  `(전체 체크인 수 − 기존 reward.checkin 가점 합)` 차액으로 일괄 지급 (멱등,
  마이그레이션 20260815000001)
- 구현: `/stats` 배너(당월 TOP5), `/admin/ranking-rewards` 미리보기·수동 지급,
  `ranking_rewards` 테이블 + `credits_ledger`(type earn, ref_type ranking_reward)
