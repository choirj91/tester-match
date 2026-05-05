# 2026-05-05 — feat/matching 브랜치 누적 요약

> PR #1 머지 후 새 브랜치에서 매칭→체크인→완주→크레딧 핵심 루프 + 정책·프로필·알림 인프라까지 일괄 처리. PR #2 머지 전 상태 스냅샷.

---

## PR #2 커밋 7개

| # | 커밋 | 내용 |
|---|---|---|
| 1 | b4f0b3e | F-MATCH-01 자율 옵트인 흐름 (`/browse/[id]` → `POST /api/matches` → `/my-tests`) |
| 2 | c8afabd | F-CHK-02 1탭 체크인 + F-CRD-02 800 크레딧 자동 적립 |
| 3 | 2306767 | `/credits` 잔액·내역 페이지 + 헤더 잔액 chip |
| 4 | 57e0393 | `/policies/{terms,privacy,refund,credits}` 4종 |
| 5 | 3627c61 | F-AUTH-04 `/profile` + 회원 탈퇴 |
| 6 | e5bed7e | 이메일 인프라 (Resend) + F-MATCH-06 매칭 알림 + 완주 알림 |
| 7 | ff779a3 | F-CHK-01 일일 체크인 리마인더 cron + `wrangler.toml` |

총 약 40+ 파일 추가, 54 tests passing.

---

## 기능 매트릭스 (현재 상태)

| 영역 | P0 항목 | 상태 |
|---|---|---|
| 인증 | F-AUTH-01 Google OAuth | ✓ (PR #1) |
| 인증 | F-AUTH-03 로그아웃·세션 만료 | ✓ |
| 인증 | F-AUTH-04 회원 탈퇴 | ✓ (PR #2) |
| 프로필 | F-PROF-01 통합 프로필 | ✓ |
| 프로필 | F-PROF-02 닉네임/타임존/카테고리 | 부분 (닉네임만) |
| 앱 | F-APP-01 앱 등록 | ✓ |
| 앱 | F-APP-02 초대 링크 검증 | URL 정규식만 (HEAD 검증 cron 미구현) |
| 앱 | F-APP-03/04 상태·수정·삭제 | ✓ |
| 매칭 | F-MATCH-01 옵트인 큐 | 자율 옵트인 (FIFO/Trust Score 알고리즘 보류) |
| 매칭 | F-MATCH-02 Boost 큐 | DB 컬럼만 (`/boost` placeholder) |
| 매칭 | F-MATCH-04 옵트아웃 자동 보충 | 옵트아웃만 ✓, 자동 보충 ✕ |
| 매칭 | F-MATCH-05 매칭 진행률 대시보드 | ✓ (`/apps/[id]`, `/my-tests`) |
| 매칭 | F-MATCH-06 매칭 알림 | ✓ (이메일) |
| 체크인 | F-CHK-01 일일 알림 | ✓ (cron, 운영 활성화 대기) |
| 체크인 | F-CHK-02 1탭 체크인 | ✓ |
| 체크인 | F-CHK-04 옵트아웃 + 사유 | ✓ |
| 체크인 | F-CHK-05 진행률 시각화 | ✓ |
| 크레딧 | F-CRD-01 충전 | ✕ (결제 미연동) |
| 크레딧 | F-CRD-02 완주 적립 | ✓ |
| 크레딧 | F-CRD-03 사용 (앱 등록 차감) | ✕ |
| 크레딧 | F-CRD-04 환불 | ✕ |
| 결제 | F-PAY-01 토스 통합 | ✕ |
| 알림 | F-NOTI-01 Resend 인프라 | ✓ |
| 알림 | F-NOTI-02 템플릿 | 3종 (matchOptIn, dailyReminder, matchCompleted) |
| 정책 | F-POL-01~04 정책 페이지 | ✓ (자체 초안 v0.1) |

---

## 운영 배포 전 환경 변수 체크

| 키 | 필수 여부 | 출처 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 필수 | Supabase Dashboard |
| `SUPABASE_SECRET_KEY` | 필수 | Supabase Dashboard (secret) |
| `NEXT_PUBLIC_APP_URL` | 필수 | 운영 도메인 |
| `RESEND_API_KEY` | 알림 활성화 시 | Resend Dashboard |
| `RESEND_FROM_EMAIL` | 알림 활성화 시 | 인증된 도메인 |
| `CRON_SECRET` | cron 활성화 시 | `openssl rand -hex 32` |
| `BREVO_API_KEY` | (보류) | Resend 한도 도달 시 fallback |
| `TOSS_*` | (보류) | F-PAY-01 진입 시 |

---

## 남은 핵심 작업 (우선순위)

### P0 (출시 전 필수)
- F-PAY-01 토스페이먼츠 (크레딧 충전)
- F-CRD-03 크레딧으로 앱 등록 시 차감
- F-CRD-04 충전 환불 (7일 이내 미사용)
- F-MATCH-04 옵트아웃 시 자동 보충 매칭 알림
- F-ADMIN-01~05 관리자 대시보드 (모니터링·신고 검토)
- 변호사 검토 (이용약관·개인정보처리방침)

### P1
- F-MATCH-03 매칭 알고리즘 가중치
- F-CHK-03 무작위 스크린샷 검증
- F-CHK-06 5일 미체크인 페널티 sweep cron
- F-APP-02 HEAD 링크 검증 cron
- F-NOTI-03 Discord 웹훅
- F-PROF-02 타임존/관심 카테고리 (현재 nickname만)

### 운영
- Cloudflare Pages 첫 배포
- Resend 도메인 인증
- 사업자등록 + 통신판매업 신고
- UptimeRobot 등록 (Supabase 일시정지 방지)

---

## 결정 메모 (이번 세션 누적)

| 항목 | 결정 | 근거 |
|---|---|---|
| 자율 옵트인 vs 알고리즘 매칭 | 자율 옵트인 우선 | 단순·검증 가능. 알고리즘은 데이터 모인 후. |
| 매칭 status flow | 'pending' 생략, 직접 'active' | 자율 옵트인은 대기 단계 불필요. |
| 14일 day_n 계산 | 24h 윈도우 (KST 무관) | 옵트인 시각 기준, timezone 단순화. |
| 미체크인 따라잡기 | 불가 (현재 day_n 만 허용) | 부정 방지. |
| 14번째 체크인 부수 효과 | 매칭 완주 + 크레딧 적립 + 메일 한 트랜잭션 | 별도 cron 회피, 즉시 반영. |
| RLS vs admin 클라이언트 | 서버 사이드는 admin + 명시적 필터 | @supabase/ssr + 신키 JWT 부착 이슈 우회. |
| 정책 본문 | spec/07_policies_draft.md 초안 그대로 게시 | "변호사 검토 후 v1.0 시행" 안내 배너로 한계 노출. |
| 회원 탈퇴 | public.users 익명화 + auth.users 삭제 | PIPA "탈퇴 시 즉시 파기" 부합. 결제·감사 로그는 5년 보존. |
| 이메일 발송 | Resend API 직접 fetch (edge 호환) | @resend/node SDK 의 edge 호환성 이슈 회피. |
| Cron 보안 | CRON_SECRET Bearer 헤더 (운영) / 미설정 통과 (로컬) | 개발 편의 + 운영 명시적 보호. |

---

## 검증 (마지막 푸시 기준)

```bash
cd 03-output/app
pnpm typecheck   # ✓
pnpm lint        # ✓
pnpm test        # ✓ 54/54
```

브라우저 검증:
- `/auth/login` → Google → 정상
- `/apps/new` → 등록 → `/apps`
- `/browse/[id]` → 옵트인 → `/my-tests`
- `/my-tests` → 오늘 체크인 → 진행률 1/14 → 카드 갱신
- `/credits` 잔액 0 (옵트인만 한 상태) / 14일 후 800
- `/profile` 닉네임 변경
- `/policies/*` 4종 표시
- `/api/auth/debug` JSON 정상

검증 안 됨 (외부 서비스 미연결):
- 이메일 실제 발송 (RESEND_API_KEY 미설정 → 콘솔 로그)
- Cron 자동 실행 (Cloudflare Pages 미배포)
