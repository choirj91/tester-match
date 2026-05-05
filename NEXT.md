# NEXT — 다음 액션

> **현재 위치**: v1 핵심 루프 작동 (옵트인 → 체크인 → 완주). 결제는 [ADR-0007](01-source/decisions/ADR-0007-payments-v2-defer.md) 로 v2 이연.
> **마지막 업데이트**: 2026-05-05

---

## 즉시 (사용자 액션)

- [ ] **PR #3 (cron-hygiene) 머지** — F-CHK-06 페널티 sweep + F-APP-02 링크 검증
- [ ] **Migration #7 적용** — `cd 03-output && supabase db push` (트리거 service_role 우회)
- [ ] **Resend 활성화** — 도메인 인증 + `RESEND_API_KEY` / `RESEND_FROM_EMAIL` 설정 → 이메일 알림 켜짐
- [ ] **CRON_SECRET 설정** — `openssl rand -hex 32`
- [ ] **Cloudflare Pages 첫 배포** — wrangler 또는 Dashboard 에서 cron 활성화
- [ ] **UptimeRobot 등록** (Supabase Free 일시정지 방지, 5분 ping)

## v1 운영 정리 (ADR-0007 후속)

- [ ] /policies/refund / /policies/credits 본문에 "베타 기간 무료 운영" 안내 추가
- [ ] 헤더 "급구 (준비중)" 메뉴 그대로 유지 — v2 진입 시 활성
- [ ] 사전 등록 사용자에게 "베타 무료 운영" 약속 메시지 추가

## v1 잔여 작업 (P0 필수)

- [ ] F-MATCH-04 옵트아웃 시 자동 보충 매칭 알림 (이메일)
- [ ] F-ADMIN-01~05 운영자 대시보드 (신고 검토 / 매칭 모니터링 — 결제 제외)
- [ ] F-AUTH-04 회원 탈퇴 — 완료 (PR #2)

## P1 (있으면 좋음)

- [ ] F-MATCH-03 가중치 알고리즘 (Trust Score / 카테고리 / 타임존)
- [ ] F-CHK-03 무작위 스크린샷 검증
- [ ] F-NOTI-03 Discord 웹훅 알림
- [ ] F-PROF-02 타임존 / 관심 카테고리 (현재 nickname 만)
- [ ] PostHog 이벤트 트래킹 (signup/app_register/match/checkin/complete) — v2 진입 판정 인프라

---

## v2 진입 트리거 (ADR-0007)

다음 중 하나 도달 시 v2 결제 도입 검토 시작:

| 지표 | 임계 |
|---|---|
| MAU | 300+ |
| 14일 완주율 | 60%+ |
| 매칭 성공률 (12명 충원) | 70%+ |
| 누적 등록 앱 | 100+ |
| 크레딧 누적 발행량 | 1,000,000+ |

---

## v2 보류 (ADR-0007)

- F-PAY-01/03/04 토스페이먼츠 결제·환불·webhook
- F-CRD-01 충전, F-CRD-04 환불
- F-CRD-03 크레딧 차감 (충전 없으니 차감도 의미 없음)
- F-ADMIN-03 결제·환불 모니터링
- 사업자등록·통신판매업 신고
- 변호사 검토 (이용약관 v1.0)

---

## 12주 로드맵 (ADR-0007 반영 갱신)

| Phase | Week | 핵심 산출물 |
|---|---|---|
| Discovery | 1~2 | 브랜드·도메인·랜딩·기반 ✓ |
| Core #1 | 3~5 | 인증·앱 등록·매칭 엔진 v1 ✓ |
| Core #2 | 6~8 | 크레딧 표시·14일 체크인·Trust Score ✓ |
| ~~Monetize~~ | ~~9~~10~~ | **v2 이연** (ADR-0007) |
| Operational | 9 | 운영자 대시보드·F-MATCH-04 보충 알림 |
| Beta | 10 | 클로즈드 베타 50명 + 핫픽스 |
| Launch | 11 | 퍼블릭 런칭 (한국 채널) + PMF 지표 측정 |

→ 12주 로드맵 → **11주** 로 단축.

---

## Discovery 병행 (Week 1 잔여)

- [ ] 브랜드명 후보 5개 + 도메인 가용성 체크 (Cloudflare Registrar 우선)
- [ ] 경쟁사 5종 직접 가입·체험 (~~결제~~ 체험만 — 무료 한도 내)
- [ ] Disquiet, GeekNews, Reddit r/kr_dev에 인터뷰 글 업로드
- [ ] 응답 5건 이상 확보 → BP v0.2 업데이트

---

## Open Questions

### 비즈니스
- [ ] Boost 가격 (49,000 / 29,000원) — v2 진입 시점에 A/B
- [ ] 적립 비율 80/20 — 결제 활성 후 검증
- [ ] v2 영어권 진입 시점 — 매칭 성공률 80% + MAU 1500 동시 도달 시
- [ ] 베타 기간 적립된 크레딧 v2 시 처리 — 그대로 유지(소멸 X)로 ADR-0007 결정

### 정책/법무 (v2 진입 시)
- [ ] 크레딧 = 선불전자지급수단 분류 여부 (금감원 사전 자문)
- [ ] 변호사 검토 (이용약관·개인정보처리방침, 약 100~200만원)

### 운영
- [ ] CS 응대 채널 — Crisp/Intercom 도입 시점
- [ ] Trust Score 어뷰징 대응 — ML 검증 도입 시점

---

## 완료 (참고)

| Week | 영역 |
|---|---|
| 1~2 | 5레이어 하네스 + Next.js + Supabase + RLS + 정책 페이지 |
| 3~4 | 인증 (Google OAuth) + 앱 등록·수정·삭제 + 게시판 |
| 5 | 매칭 옵트인·옵트아웃 + 14일 체크인 + 완주 크레딧 적립 |
| 6 | 이메일 인프라(Resend) + cron(리마인더·페널티 sweep·링크 검증) |
| ADR | 0001 한국 / 0002 CF Pages / 0003 1원=1크레딧 / 0004 Supabase Auth / 0005 게시판 v1 / 0006 앱 상태·댓글 / 0007 결제 v2 이연 |

---

## 다음 작업자에게

1. 먼저 [README.md](README.md) → [01-source/decisions/](01-source/decisions/) 순으로 읽으면 30분 내 컨텍스트 회복.
2. 잠금 결정과 충돌하는 작업이 필요하면 **코드 전에 ADR을 추가**한다.
3. 각 Week 시작 시 이 NEXT.md 를 업데이트.
4. 기획 변경은 `01-source/spec/` 직접 수정 X → 새 ADR + 04-review/history/.
