# Tester Match (가칭) — 사업계획서 v0.1

> Google Play Closed Testing 12명/14일 요건 해소를 위한 글로벌 품앗이(Co-Testing) 매칭 플랫폼

- **문서 종류**: 내부 정리용 (실행 로드맵 중심)
- **작성일**: 2026-05-04
- **버전**: v0.1 (Draft)
- **작성자**: nakjun

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [문제 정의 (Problem)](#2-문제-정의-problem)
3. [솔루션 개요 (Solution)](#3-솔루션-개요-solution)
4. [시장 분석 (Market Sizing)](#4-시장-분석-market-sizing)
5. [경쟁 분석 (Competitive Landscape)](#5-경쟁-분석-competitive-landscape)
6. [차별화 전략 (Differentiation)](#6-차별화-전략-differentiation)
7. [비즈니스 모델 (Revenue Model)](#7-비즈니스-모델-revenue-model)
8. [MVP 범위 (12주)](#8-mvp-범위-12주-출시-기준)
9. [기술 아키텍처](#9-기술-아키텍처-권장-tech-stack)
10. [정책·법무 리스크](#10-정책법무-리스크와-대응)
11. [KPI / PMF 지표](#11-kpi-및-pmf-검증-지표)
12. [12주 실행 로드맵](#12-12주-실행-로드맵)
13. [v2 / v3 확장](#13-v2--v3-확장-로드맵)
14. [팀 / 리소스](#14-팀--리소스-가정)
15. [Open Questions](#15-아직-결정되지-않은-것-open-questions)
16. [Next Actions](#16-next-actions-이번-주)

---

## 1. Executive Summary

Tester Match (가칭)는 Google Play의 Closed Testing 12명/14일 요건을 가장 빠르고 안전하게 충족시키는 **한국형 품앗이 매칭 플랫폼**이다. 인디 개발자가 서로의 앱을 테스트해주는 "co-testing" 방식을 자동화하여, 현재 오픈채팅·디스코드·구글폼 기반의 수동 운영을 웹 서비스 형태로 전환한다. v1은 한국 시장 우선, v2부터 영어권 글로벌 확장을 목표로 한다.

### 핵심 가치 제안 (Value Proposition)

- **개발자**: 평균 3~7일 안에 12명의 활성 테스터를 확보 (현재 평균 2~4주 소요)
- **테스터(=다른 개발자)**: 내 앱에 필요한 테스터를 무료로 확보할 권리(크레딧)
- **플랫폼**: "급구" 결제 채널 + 부가 서비스로 안정적 수익 확보

### 핵심 결정 사항 (Decision Snapshot)

| 항목 | 결정 |
|---|---|
| 정책 포지셔닝 | A안 — 품앗이/크레딧 모델 (현금 인센티브 없음). Google Play의 incentivized review 정책 회피. |
| MVP 범위 | 최소 코어: 회원가입, 앱 등록, 테스터 매칭, 결제(급구), 급구 채널. 게시판·앱·다국어는 v2. |
| 타겟 시장 | **한국 우선** — KRW 결제, 한국어 UI. 영어권 확장은 v2. |
| 호스팅 | **Cloudflare Pages + Supabase** (Vercel Hobby 상업 약관 회피, 1년차 고정비 ≈ 도메인 1만원/년) |
| 결제 | **토스페이먼츠 (KRW)** v1, Stripe (USD) v2 |
| 크레딧 단위 | **1원 = 1 크레딧**. 1매칭 = 1,000원 (테스터 800원 적립 + 플랫폼 200원 수수료) |
| 출시 목표 | 12주 이내 MVP 런칭, 12주차에 첫 유료 결제 전환 발생 |
| BP 용도 | 내부 정리용. 실행 로드맵·리스크·KPI 중심. 외부 IR 발췌 가능. |

### 정직한 한 줄 요약

> 이미 동일 모델 경쟁자가 다수 존재하는 "이미 검증된 그러나 레드오션에 가까운" 시장이다. 성공의 핵심은 (1) 매칭 속도, (2) 테스터 활성도/14일 유지율, (3) 다국어/시간대 자동화 운영, 세 가지에 있다. 첫 90일은 PMF가 아닌 "운영 자동화 효율"을 검증하는 기간으로 본다.

---

## 2. 문제 정의 (Problem)

### 2.1 Google Play의 정책 변화 (Fact)

- 2023년 11월 13일 이후 신설된 "개인(personal)" 개발자 계정은 프로덕션 액세스 신청 전 Closed Testing에서 **12명 이상의 테스터를 14일 연속 옵트인 상태로 유지**해야 함.
  - 초기 정책은 20명이었으나 이후 12명으로 완화.
  - "조직(organization)" 계정은 이 요건 적용 제외.
  - Google은 fake/duplicate 계정, 에뮬레이터, 비활성 테스터를 감지하여 무효 처리함.
  - 출처: [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)

### 2.2 개발자가 실제로 겪는 통증 (Pain Points)

1. 12명을 14일 동안 "연속 옵트인" 상태로 유지하는 것이 어려움 — 한 명이라도 중간에 옵트아웃하면 카운트 리셋.
2. 주변에 안드로이드 사용자 12명을 알고 있어도, 실제로 14일 내내 설치·실행을 유지시키기 어려움.
3. 기존 오픈채팅·디스코드 운영 방식은 (a) 매칭 수동, (b) 매칭 신뢰성 낮음, (c) 14일 추적 불가.
4. "무료 품앗이"는 응답 지연·사기·노쇼 비율이 높음.
5. "유료 대행"은 fake 계정 사용 시 Google에 적발 → 출시 무산 + 계정 정지 위험.

### 2.3 시장 검증 신호 (Demand Signals)

- 크몽·Disquiet·brunch·velog에서 "비공개 테스트 12명 모집" 키워드의 글이 다수 노출 (한국).
- Reddit r/androiddev, Adalo Forum, Google Play Developer Community에서 동일 통증을 호소하는 글이 지속 등장 (영어권).
- 이미 LaunchPad, BETAFLOW, Testers Community, PrimeTestLab, 12testers14days 등 다수 서비스가 운영 중 → 시장 존재 자체는 강하게 검증됨.

---

## 3. 솔루션 개요 (Solution)

### 3.1 핵심 메커니즘

두 종류의 사용자를 한 사람이 동시에 수행한다 — "내 앱이 테스트받기를 원하는 개발자" = "다른 앱을 테스트해줄 수 있는 사람".

#### 크레딧 경제 (Credit Economy)

- 단위: **1원 = 1 크레딧** (KRW 1:1)
- 내 앱 매칭 1건 비용: **1,000 크레딧** (= 1,000원)
- 14일 매칭 완주 시 테스터 적립: **800 크레딧** (= 800원, 80%)
- 플랫폼 수수료: **200 크레딧** (= 200원, 20%)
- 12명 모집 = 12,000 크레딧 (= 12,000원) 필요
- 크레딧 부족 시 토스페이먼츠로 충전 (1,000/5,000/10,000/30,000/50,000원 + 직접 입력)
- 외부 포인트 전환(네이버페이/카카오페이)은 **v3**부터 활성화

#### 두 가지 매칭 채널

| 채널 | 일반 풀 (Regular Pool) | 급구 (Boost / Urgent) |
|---|---|---|
| 진입 방식 | 크레딧 보유 시 자동 등록 | KRW 결제로 즉시 노출 (토스페이먼츠) |
| 매칭 우선순위 | FIFO + 가중치 (활성도/14일 유지율) | 최상단 노출, 알림 푸시 |
| 예상 매칭 시간 | 3~7일 | 24~48시간 |
| 가격 (가정) | 크레딧 차감 (12,000원/12명) | 24h SLA 49,000원 / 48h SLA 29,000원 |
| 플랫폼 수익 | 매칭당 200원 수수료 | Boost 결제 수익 (핵심 매출, 매칭비 포함) |

### 3.2 자동화 포인트

- Google Play Console 초대 링크 입력 → 시스템이 매칭된 테스터에게 자동 발송
- 테스터의 14일 유지 여부를 자가 보고(체크인) + 무작위 스크린샷 인증으로 검증
- 14일 미만 옵트아웃 발생 시 자동 알림 → 다른 테스터 자동 보충
- 알림 큐 — v1은 KST(Asia/Seoul) 기준, v2 영어권 확장 시 사용자별 IANA 타임존으로 다중화

---

## 4. 시장 분석 (Market Sizing)

> 정확한 통계는 공개되지 않으므로 보수적 추정과 가정을 분리해 명시한다.
> v1은 한국 시장만 대상. v2 영어권 글로벌 잠재는 §4.4에 별도 표시.

### 4.1 TAM (Total Addressable Market) — 한국 안드로이드 신규 개인 개발자

- Google Play 한국 신규 앱 등록 수: 연간 약 10~15만 건 (Sensor Tower / data.ai 추정 기반)
- 이 중 "신규 개인 개발자 계정" 비중: 추정 30~40% (조직 계정 제외)
- **→ 한국 신규 개인 개발자 추정 TAM = 약 3~6만 명/년**

### 4.2 SAM (Serviceable Addressable Market)

- 이 중 "테스터를 자력으로 12명 모으기 어려운" 1인/소형 개발자: 추정 60% = 약 1.8~3.6만 명/년
- 이 중 디지털 마케팅으로 도달 가능한 비중 (Disquiet, 브런치, velog, 안드로이드 카페 등): 추정 30% = **약 5,400~10,800명/년**

### 4.3 SOM (Serviceable Obtainable Market) — 1년차 목표

- SAM 중 첫 12개월 내 우리 서비스 인지·등록할 비중: 5% 가정 = **약 270~540명**
- 이 중 "급구(Boost)" 1회 이상 결제 전환: 20% 가정 = **약 50~100건**
- 연간 결제 GMV 가정: 100건 × 평균 39,000원 = **약 390만원 (기본 시나리오)**

> ⚠️ 위 수치는 모두 가정이며, 1차 PMF 검증의 1차 목표는 "GMV"가 아니라 **"매칭 성공률 80% 이상"** 임.

### 4.4 v2 글로벌 영어권 잠재 (참고)

- 영어권 신규 개인 개발자 TAM: 약 15~20만 명/년 (한국의 약 3~5배)
- v2 진입 시 1년차 추가 SOM: 약 1,500명 등록 + 300건 결제 가능
- 추가 매출 잠재: 약 USD $9,000 (≈ 1,200만원/년)
- v2 진입은 v1 PMF 검증 + 영어 UI/Stripe 결제 추가 (3~6개월) 이후

---

## 5. 경쟁 분석 (Competitive Landscape)

이 시장은 이미 다수의 플레이어가 존재하는 레드오션이다. 차별화 전략은 별도 섹션에서 다룬다.

| 서비스 | 권역 | 모델 | 강점 | 약점 |
|---|---|---|---|---|
| [LaunchPad (apptesters.cc)](https://apptesters.cc/) | 한국 | 품앗이 크레딧 | 커뮤니티 활성 | 자동화 부족 |
| [BETAFLOW (closedtesting12.com)](https://closedtesting12.com/ko/index) | 한국 | 실기기 자동 + 품앗이 | 자동 설치/로그 | 정책 회색지대 |
| [크몽 12명 모집](https://kmong.com/gig/543235) | 한국 | 개인 전문가 대행 | 결제 신뢰 | scale 어려움 |
| [Testers Community](https://www.testerscommunity.com/) | 글로벌(영어) | 품앗이 + 유료 | 브랜드 인지 | UX 노후 |
| [PrimeTestLab](https://primetestlab.com/google-play-12-testers) | 글로벌(영어) | 유료 대행 중심 | 빠른 매칭 | 정책 리스크 |
| [12testers14days.com](https://12testers14days.com/) | 글로벌(영어) | 유료 대행 | 도메인 SEO 우위 | 정책 리스크 |

### 5.1 경쟁 분석 결론

- "유료 대행" 진영은 fake 계정 의심 → 정책 리스크 보유
- "품앗이" 진영은 안전하지만 자동화·매칭 속도가 약함
- **Tester Match는 "품앗이의 안전성" + "유료 대행의 매칭 속도" 사이의 빈 자리를 노린다**

---

## 6. 차별화 전략 (Differentiation)

### 6.1 우리만의 4가지 Wedge

1. **Trust Score** — 테스터의 "14일 유지율" 기반 점수 시스템. 점수 높은 테스터에게 매칭 우선권.
2. **Auto-Reminder** — 14일 동안 자동 체크인 알림 + 옵트아웃 위험 사전 경고 (이메일·푸시).
3. **Time-Zone Smart Matching** — 글로벌 타임존 매칭 (개발자 위치 무관 활성도 보장).
4. **Boost SLA** — 급구 결제 시 "48시간 내 12명 매칭 미달성 시 환불" 보장.

### 6.2 "Don'ts" — 의도적으로 하지 않는 것

- 현금/포인트 인센티브 지급 → Google Play incentivized 정책 위반 가능성 회피
- Fake/Bot 테스터 풀 보유 → 적발 시 고객 계정까지 정지 위험
- 앱 다운로드 수/리뷰 부풀리기 서비스 → 별도 정책 위반

---

## 7. 비즈니스 모델 (Revenue Model)

### 7.1 5가지 매출원 (Multi-Revenue)

| 매출원 | 과금 방식 | 가격(가정) | 타겟 고객 |
|---|---|---|---|
| **Boost (급구)** | 1회 결제, 12명 매칭 보장 | 24h SLA 49,000원 / 48h SLA 29,000원 | 출시 임박 / 시간 부족 |
| **Pro 구독** | 월 정기결제, 무제한 등록 | 9,900원/월 | 다수 앱 운영자 |
| 크레딧 직접 충전 | 1원 = 1 크레딧 단위 충전 | 1,000~50,000원 패키지 + 직접 입력 | 일반 사용자 |
| 부가 서비스 (v3) | 스토어 등록 컨설팅, 스크린샷, 번역 | 19,000~199,000원 | 초보 개발자 |
| 광고/제휴 | 개발자 도구 제휴 광고 | CPC/CPA | v2 이후 |

### 7.2 수익 구조 시뮬레이션 (29,000원 Boost 1건 기준)

| 항목 | 토스페이먼츠 (국내 카드) | 토스페이먼츠 (간편결제) |
|---|---|---|
| 총 결제 금액 | 29,000원 | 29,000원 |
| PG 수수료 | 2.5%~3.0% = 약 870원 | 2.5%~3.5% = 약 870원 |
| 테스터 적립 (12명 × 800원) | 9,600원 (크레딧 적립, 미환급) | 9,600원 |
| VAT (부가세 10%, 매출 신고 시 정산) | 2,636원 | 2,636원 |
| **순매출 (Net, VAT/PG/적립 차감)** | **≈ 15,894원 (55%)** | **≈ 15,894원 (55%)** |

> 참고: 토스페이먼츠 계좌이체 사용 시 수수료 1.5%로 더 유리. v2에서 Stripe(USD) 추가 시 수수료 2.9% + $0.30.

### 7.3 1년차 매출 시나리오 (보수/기본/공격, 한국 시장 기준)

| 지표 | 보수 | 기본 | 공격 |
|---|---|---|---|
| 등록 개발자 | 200명 | 500명 | 1,500명 |
| Boost 결제 전환율 | 15% | 20% | 30% |
| 연간 결제 건수 | 30건 | 100건 | 450건 |
| 평균 Boost 가격 | 39,000원 | 39,000원 | 39,000원 |
| 연 GMV (KRW) | 117만원 | 390만원 | 1,755만원 |
| Pro 구독자 (가정) | 5명 | 30명 | 100명 |
| 연 ARR (KRW, 9,900원 × 12) | 59만원 | 356만원 | 1,188만원 |
| **총 연 매출 (KRW)** | **≈ 176만원** | **≈ 746만원** | **≈ 2,943만원** |

> → 1년차 한국 시장 단독으로는 작은 규모. 의미는 "PMF 검증 + v2 영어권 확장의 기반"에 있음. v2에서 영어권 진입 시 추가 1,200만원/년 잠재 (§4.4 참고).

---

## 8. MVP 범위 (12주 출시 기준)

### 8.1 Must-Have (반드시 포함)

1. 회원가입/로그인 (Email + Google OAuth)
2. 개발자 프로필 (앱 OS, 카테고리, 타임존)
3. 앱 등록 (앱 이름, Google Play 초대 링크, 설명, 카테고리, 필요 테스터 수=12)
4. 크레딧 시스템 (지급/소비/잔액 조회)
5. 매칭 엔진 (FIFO + Trust Score 가중치)
6. Boost 결제 (토스페이먼츠, KRW)
7. 14일 자동 체크인 + 옵트아웃 감지
8. 이메일 알림 (가입, 매칭, 14일 카운트다운)
9. 관리자 대시보드 (매칭/결제/CS 모니터링)

### 8.2 Nice-to-Have (12주 내 가능하면 포함)

- Discord/Slack 알림 통합
- Trust Score 공개 프로필
- 기본 영어 FAQ 페이지 + 챗봇

### 8.3 Out-of-Scope (v2 이후)

- 게시판 / Q&A / 커뮤니티 (v2)
- 모바일 앱 (iOS/Android — v3, IAP 30% 수수료 부담 큼)
- 다국어 (한/일 — v2)
- 다통화 결제 (KRW/JPY — v2)
- 부가 서비스 마켓플레이스 (스크린샷/번역) — v3
- 크레딧 P2P 거래소 — v3

---

## 9. 기술 아키텍처 권장 (Tech Stack)

> 상세는 `docs/08_tech_stack.md` 참고. 본 절은 요약.

### 9.1 권장 스택 (1인/소수 개발 기준, 무료 우선)

| 계층 | 권장 | 이유 |
|---|---|---|
| 프론트엔드 | Next.js 15 (App Router) + Tailwind CSS | SEO 강함, App Router 안정화 |
| 백엔드 | Next.js API Routes (+ Supabase Edge Functions) | 초기 단순화, 트래픽 증가 시 분리 가능 |
| DB + Auth + Storage | **Supabase Free → Pro** | 관리형 PostgreSQL + RLS + Auth 통합. Free는 1주 비활성 시 자동 정지(UptimeRobot ping 필수) |
| 결제 (v1) | **토스페이먼츠 (KRW)** + Webhooks | 한국 우선, 카드/계좌이체/카카오페이/네이버페이 통합 |
| 결제 (v2) | Stripe Checkout (USD) | 영어권 확장 시점 추가 |
| 이메일 | **Resend (메인) + Brevo (백업)** | Resend 100통/일 한도 → Brevo 300통/일로 이중화 |
| Cron/Job | **Cloudflare Cron Triggers** (무료) | 14일 카운트, Boost SLA, Supabase ping |
| 로깅/에러 | Sentry Free + PostHog Free | 1년차 무료 한도 내 |
| 호스팅 | **Cloudflare Pages + Supabase** | Cloudflare Pages는 상업 사용 OK + bandwidth 무제한. Vercel Hobby는 비상업 약관 위반 |
| DNS/CDN/WAF/도메인 | Cloudflare (Registrar 원가 $10/년) | 통합 관리, DDoS 무제한 무료 |
| 모니터링 | UptimeRobot Free (5분 ping) | Supabase Free 일시정지 방지 필수 |

### 9.2 핵심 데이터 모델 (Entity 개요)

- `User` (id, email, country, timezone, trust_score)
- `App` (id, owner_user_id, name, store_link, status, required_testers)
- `Match` (id, app_id, tester_user_id, opted_in_at, opt_out_at, status)
- `Credit` (id, user_id, amount, type [earn/spend/purchase], related_match_id)
- `Payment` (id, user_id, app_id, amount_krw, currency, provider, status, refund_status) — v2부터 `amount_original`/`currency`로 다통화
- `CheckIn` (id, match_id, day_n, screenshot_url, verified)

---

## 10. 정책·법무 리스크와 대응

### 10.1 Google Play 정책 리스크

| 리스크 | 발생 가능성 | 대응 |
|---|---|---|
| Incentivized testing 적발 | 낮음 (현금 미지급) | 크레딧은 시간/노동 교환임을 약관·FAQ에 명시 |
| Fake 계정 적발 | 중간 (사용자 측 책임) | KYC-lite (Google OAuth 1인 1계정), Trust Score 페널티 |
| Google Play 약관 변경 | 높음 (과거 변동 잦음) | 정책 모니터링 담당자 1인 지정, 분기 1회 약관 리뷰 |
| 개인정보 (이메일·초대링크) | 중간 | GDPR/CCPA 대응 — 최소 수집, 삭제 요청 처리, DPA 명시 |

### 10.2 결제·세무 리스크 (한국 우선)

- 부가세 — 한국 부가가치세법 10% 자동 정산 (토스페이먼츠 대시보드 + 분기 신고). v2 영어권 진입 시 Stripe Tax 도입 검토
- 환불/분쟁 — Boost SLA 미달 시 자동 환불 정책 명문화 (PG Chargeback 방어)
- 대한민국 사업자 등록 — 1년차 매출 8천만원 미만이라면 간이과세 검토 (전자상거래업/통신판매업 신고 필수)
- 통신판매업 신고 — 관할 구청. 매출 무관 사업 시작 시 의무
- 해외 결제 수익(v2) — 외화수입신고는 연 USD $5만 미만 시 부담 낮음

---

## 11. KPI 및 PMF 검증 지표

### 11.1 North Star Metric

> **"14일 매칭 완료 성공률" (Successful Match Completion Rate)**
> 등록된 앱 중 12명이 14일 연속 옵트인을 성공적으로 마친 비율.

### 11.2 단계별 게이트 KPI

| 단계 | 기간 | 지표 | 목표 |
|---|---|---|---|
| Pre-Launch | Week 1~12 | Waitlist 가입 | 200명 |
| Launch | Week 12~16 | 등록 앱 수 | 100건 |
| Operational | Week 16~24 | 매칭 성공률 | 80% 이상 |
| Monetization | Week 16~24 | Boost 첫 결제 | Week 12 내 1건 |
| Scale | Month 6~12 | MAU / 월 결제 건수 | MAU 1,500 / 25건 |

---

## 12. 12주 실행 로드맵

### Week 1~2: Discovery & Foundation

- 도메인 등록 (.com 우선 - testermatch.com 등 후보 검토)
- 브랜드명 확정 (한국어 검색·발음 친화 + v2 영어권 확장 대비)
- 경쟁사 5종 직접 가입·체험 → 매칭 시간/UX 측정
- 랜딩 페이지 제작 + Waitlist 수집 시작
- 기술 스택 확정, GitHub 리포 셋업, CI/CD

### Week 3~5: Core Build #1 — 인증 + 앱 등록 + 매칭 엔진

- 회원가입 (NextAuth + Google OAuth)
- 앱 등록 폼 + Google Play 초대 링크 검증
- 매칭 엔진 v1 (FIFO, Trust Score 없이)
- 이메일 발송 인프라 (Resend) — 매칭 알림 템플릿

### Week 6~8: Core Build #2 — 크레딧 + 14일 추적

- 크레딧 시스템 (지급/소비/잔액)
- 14일 체크인 시스템 + 자동 카운트다운 알림
- 옵트아웃 감지 → 자동 보충 매칭
- Trust Score v1 알고리즘

### Week 9~10: Monetization — Boost + 결제

- 토스페이먼츠 Checkout/Webhook 통합 (KRW)
- Boost SLA 로직 (24/48시간 미달 시 자동 부분 환불)
- 결제·환불 관리자 대시보드
- 개인정보처리방침/이용약관 (한국어, PIPA 대응) — 변호사 검토

### Week 11: Beta — Closed Beta with Waitlist

- Waitlist 200명 중 50명 초청
- 매칭 성공률, 14일 유지율, NPS 측정
- 주요 버그 핫픽스

### Week 12: Public Launch + Growth

- **Disquiet, GeekNews, 브런치, velog, Reddit r/kr_dev, 인디해커스 KR** 런칭
- SEO 콘텐츠 5편 ('Google Play 비공개 테스트 12명 14일 모집법', '인디 개발자 품앗이 가이드' 등)
- 초기 유료 결제 발생 모니터링 → KPI 게이트 평가

---

## 13. v2 / v3 확장 로드맵

### v2 (출시 후 3~6개월) — 영어권 글로벌 확장

- **영어 UI (i18n) + Stripe (USD) 결제 추가**
- 게시판 / Q&A 커뮤니티
- Discord/Slack 봇 통합
- Apple TestFlight 지원 (iOS 시장 진입)
- 다중 타임존 매칭 (사용자별 IANA tz)

### v3 (출시 후 6~12개월)

- 일본어 UI + JPY 결제 (일본 인디 개발자 유입)
- **외부 포인트 전환 활성화** (네이버페이/카카오페이) — 선불전자지급수단 발행업 등록 후
- 모바일 앱 (Android 우선) — 단, IAP 수수료 30% 영향 분석 후
- 부가 서비스 마켓플레이스 (스크린샷, 번역, ASO 컨설팅)
- 크레딧 P2P 거래소 (AML 검토 필요)
- 기업(조직) 계정용 B2B 플랜

---

## 14. 팀 / 리소스 가정

### 14.1 1년차 최소 팀

- Founder (Full-stack, 본인) — Product + Eng + CS
- 프리랜서 디자이너 (UI/UX, 8주간 part-time)
- 프리랜서 마케터 (런칭 후 4주간 콘텐츠/SEO)

### 14.2 1년차 예상 비용 (KRW, 무료 우선 스택 기준)

| 항목 | 연간 추정 (KRW) | 비고 |
|---|---|---|
| 도메인 (.com, Cloudflare Registrar) | 1.3만원 | 원가 $10/년 |
| Cloudflare Pages + DNS + WAF | **0원** | 상업 사용 OK + bandwidth 무제한 |
| Supabase Free → Pro 전환 (6개월 후) | 약 18만원 | $25/월 × 6개월 |
| Resend Free + Brevo Free | **0원** | 100통/일 + 300통/일 이중화 |
| 토스페이먼츠 PG 수수료 | 매출의 2.5~3% | 거래 시에만 |
| Sentry Free + PostHog Free | **0원** | 1년차 무료 한도 내 |
| 디자인 외주 (1회성, part-time 8주) | 약 250만원 | 프리랜서 시세 |
| 마케팅 (콘텐츠 + 초기 Ads) | 약 400만원 | Disquiet/SEO/소액 광고 |
| 법무·약관 검토 (1회성, 변호사) | 약 150만원 | docs/07 변호사 검토 권장값 |
| 사업자등록·통신판매업 신고 | 약 5만원 | 1회성 |
| **합계 (1년차, Founder 인건비 제외)** | **≈ 824만원 + 매출의 3%** | |

> → 기본 시나리오 매출 약 746만원 - 비용 약 850만원 = **1년차 영업적자 약 100만원** (Founder 인건비 미반영). 공격 시나리오 도달 시 약 2,000만원 흑자. 정상적 부트스트랩 패턴이며, 핵심은 **PMF 검증 + v2 영어권 확장 진입권**임.

---

## 15. 아직 결정되지 않은 것 (Open Questions)

> 내부용 BP인 만큼 솔직하게 미해결 항목을 모두 명시한다. 본 항목들은 PMF 검증 과정에서 답을 찾는다.

### 15.1 비즈니스/전략

1. 브랜드명 — "Tester Match"는 가칭. 도메인·상표 가용성 미확인.
2. Boost 가격 — 29,000원 / 49,000원이 적정한지 A/B 테스트 필요 (한국 인디 개발자 지불의향 검증).
3. Boost 적립 비율 — 매칭당 800원 적립 + 200원 수수료 비율(80/20)이 적정한가? (테스터 활성도 vs 플랫폼 마진)
4. 초기 14일 동안 크레딧 풀이 부족할 경우 "플랫폼이 시드 테스터를 직접 운영"할지 여부.
5. v2 영어권 진입 시점 — v1 매칭 성공률 80% 도달 후 vs 12개월 정량 게이트.

### 15.2 정책/법무

1. 크레딧이 "선불전자지급수단"으로 분류되어 발행업 등록 대상이 되는지 (한국 금감원 검토 필요). v3 외부 포인트 전환 활성화 시 필수.
2. 크레딧 양도/거래가 가능할 때 자금세탁방지(AML) 의무 발생 여부.
3. Apple TestFlight 지원(v2) 시 Apple의 별도 정책 검토 (TestFlight 자체는 100명까지 가능, 성격이 다름).

### 15.3 운영

1. CS 응대 — 글로벌 24/7 응대 vs. UTC 업무시간만 → Intercom/Crisp 도입 시점.
2. Trust Score 부정 행위 어뷰징 대응 (스크린샷 위조 등) — ML 검증 도입 시점.
3. 환불 분쟁 — 토스페이먼츠 Chargeback 대응 SOP 수립 (v2부터 Stripe 추가).

---

## 16. Next Actions (이번 주)

1. 브랜드명 후보 5개 + 도메인 가용성 체크 (Cloudflare Registrar 우선)
2. 경쟁사 5종 직접 가입·결제·체험 (개인 부담 약 15~30만원)
3. Waitlist 랜딩 페이지 (Carrd/Framer로 1일 내 제작, 한국어)
4. Disquiet, GeekNews, Reddit r/kr_dev에 "Google Play 비공개 테스트 12명 모집의 가장 큰 어려움?" 인터뷰 글 업로드
5. 응답 5건 이상 확보 → 차주 BP v0.2 업데이트

---

## 변경 이력 (Changelog)

| 버전 | 날짜 | 변경 사항 | 작성자 |
|---|---|---|---|
| v0.1 | 2026-05-04 | 최초 작성 (16개 섹션, 내부 정리용) | nakjun |
| v0.1.1 | 2026-05-04 | 핵심 결정 3종 잠금 반영: ① 한국 우선(KRW/한국어 v1, 영어권 v2), ② Cloudflare Pages + Supabase 호스팅, ③ 1원=1크레딧 모델(1매칭 1,000원, 테스터 800/플랫폼 200). §1.2/3/4/7/9/10/11/12/13/14/15/16 일괄 통일. | nakjun |

---

## 참고 자료 (Sources)

- [App testing requirements for new personal developer accounts — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play's policy on incentivized ratings, reviews, and installs — Android Developers Blog](https://android-developers.googleblog.com/2017/06/google-plays-policy-on-incentivized.html)
- [LaunchPad — apptesters.cc](https://apptesters.cc/)
- [BETAFLOW — closedtesting12.com](https://closedtesting12.com/ko/index)
- [Testers Community](https://www.testerscommunity.com/)
- [PrimeTestLab](https://primetestlab.com/google-play-12-testers)
- [12testers14days.com](https://12testers14days.com/)
- [크몽 — 비공개 테스트 12명 모집](https://kmong.com/gig/543235)
