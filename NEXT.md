# NEXT — 다음 액션

> **현재 위치**: 12주 로드맵 **Week 2** (코드 스켈레톤 완료, 외부 서비스 연결 대기)
> **마지막 업데이트**: 2026-05-04

---

## 즉시 (사용자 액션)

- [x] ~~pnpm install + dev 검증~~ (2026-05-04 완료)
- [x] ~~Supabase 프로젝트 연결 + 12 테이블 적용~~ (2026-05-04 완료)
- [x] ~~Waitlist API ↔ Supabase end-to-end 검증~~ (2026-05-04 완료)
- [ ] **Google OAuth 자격증명 등록** — [03-output/infra/supabase-auth-setup.md](03-output/infra/supabase-auth-setup.md) 1~3단계
- [ ] **마이그레이션 #4 적용** — `cd 03-output && supabase db push` (auth_link + RLS 정책 + apps 폼 필드)
- [ ] `/auth/login` Google 로그인 검증 → `public.users` 자동 생성 확인
- [ ] GitHub Private 레포 푸시는 완료. CI 그린 확인 (Actions 탭)
- [ ] UptimeRobot 등록 (Supabase Free 일시정지 방지, 5분 ping)

## Discovery 병행 (Week 1 잔여)

- [ ] 브랜드명 후보 5개 + 도메인 가용성 체크 (Cloudflare Registrar 우선)
- [ ] 경쟁사 5종 직접 가입·결제·체험 (LaunchPad, BETAFLOW, 크몽, Testers Community, PrimeTestLab)
- [ ] Disquiet, GeekNews, Reddit r/kr_dev에 인터뷰 글 업로드
- [ ] 응답 5건 이상 확보 → BP v0.2 업데이트

## Week 2 — 완료된 코드 스켈레톤

- [x] Next.js 15 (App Router) + TS + Tailwind 4 (`03-output/app/`)
- [x] Cloudflare Pages 호환 빌드 (`@cloudflare/next-on-pages`) + 환경 변수 템플릿
- [x] Supabase 마이그레이션 — ERD 12 테이블 + waitlist_signups + RLS ENABLE (`03-output/supabase/`)
- [x] Waitlist 랜딩 페이지 (한국어, Trust Blue + Pretendard)
- [x] GitHub Actions CI (lint + typecheck + test + build)
- [x] 인프라 가이드 (`03-output/infra/cloudflare-pages.md`)

세션 기록: [04-review/history/2026-05-04-week2-scaffold.md](04-review/history/2026-05-04-week2-scaffold.md)

---

## 12주 로드맵 (요약)

| Phase | Week | 핵심 산출물 |
|---|---|---|
| Discovery | 1~2 | 브랜드·도메인·랜딩·기반 |
| Core #1 | 3~5 | 인증·앱 등록·매칭 엔진 v1 |
| Core #2 | 6~8 | 크레딧·14일 체크인·Trust Score |
| Monetize | 9~10 | 토스페이먼츠·Boost SLA·환불 |
| Beta | 11 | 클로즈드 베타 50명 + 핫픽스 |
| Launch | 12 | 퍼블릭 런칭 (한국 채널) + KPI 게이트 |

상세: [01-source/bp/Tester_Match_사업계획서_v0.1.md §12](01-source/bp/Tester_Match_사업계획서_v0.1.md)

---

## Open Questions (결정 대기)

### 비즈니스
- [ ] Boost 가격 — 24h SLA 49,000원 / 48h SLA 29,000원 적정성 (A/B 테스트 필요)
- [ ] 적립 비율 80/20 — 테스터 활성도 vs 플랫폼 마진 균형 검증
- [ ] 시드 테스터 — 초기 14일 크레딧 풀 부족 시 플랫폼 직접 운영 여부
- [ ] v2 영어권 진입 시점 — 매칭 성공률 80% 도달 후 vs 12개월 정량 게이트

### 정책/법무
- [ ] 크레딧 = 선불전자지급수단 분류 여부 (금감원 사전 자문, v3 외부 전환 활성화 전 필수)
- [ ] 크레딧 양도/거래 시 AML 의무
- [ ] 변호사 검토 (이용약관·개인정보처리방침, 약 100~200만원, 출시 전)

### 운영
- [ ] CS 응대 채널 — Crisp/Intercom 도입 시점
- [ ] Trust Score 어뷰징 (스크린샷 위조) 대응 — ML 검증 도입 시점

상세: [01-source/bp/Tester_Match_사업계획서_v0.1.md §15](01-source/bp/Tester_Match_사업계획서_v0.1.md)

---

## KPI 게이트

| 단계 | 지표 | 목표 | 미달성 시 |
|---|---|---|---|
| Pre-Launch (W1~12) | Waitlist 가입 | 200명 | 마케팅 채널 재검토 |
| Launch (W12~16) | 등록 앱 수 | 100건 | 매칭 메커니즘 점검 |
| Operational (W16~24) | 매칭 성공률 | 80% 이상 | 14일 체크인 UX 개선 |
| Monetization (W16~24) | Boost 첫 결제 | W12 내 1건 | Boost 가격·노출 재설계 |
| Scale (M6~12) | MAU / 월 결제 | 1,500 / 25건 | v2 글로벌 확장 검토 |

---

## 다음 작업자에게

1. 먼저 [README.md](README.md) → [01-source/decisions/](01-source/decisions/) 순으로 읽으면 30분 내 컨텍스트 회복.
2. 잠금 결정과 충돌하는 작업이 필요하면 **코드 전에 ADR을 추가**한다 (`01-source/decisions/ADR-NNNN-*.md`).
3. 각 Week 시작 시 이 NEXT.md를 업데이트한다 (지난 주 체크리스트 → 04-review/history/).
4. 기획 변경은 `01-source/spec/` 직접 수정 X → 새 ADR + 04-review/history/에 변경 사유 기록.
