# 메뉴 구조도 / Sitemap (Information Architecture) — Tester Match v1

> 작성일: 2026-05-04 / Version: v0.1
> 본 문서는 **웹페이지의 정보 구조와 권한별 메뉴 노출**을 정의한다.

---

## 1. 권한 매트릭스 (누가 무엇을 보는가)

| 권한 | 설명 |
|---|---|
| **Guest** | 비로그인 방문자 |
| **User** | 로그인 사용자 (개발자 + 테스터 통합) |
| **Admin** | 운영자 |

> 한 명의 User가 동시에 "내 앱 등록(개발자)"과 "다른 앱 테스트(테스터)"를 할 수 있다. 별도 가입 없음.

---

## 2. 전체 사이트맵 (계층 구조)

```
Tester Match (testermatch.com)
│
├── [Public — Guest 접근 가능]
│   ├── / (랜딩 홈)
│   ├── /how-it-works (서비스 소개)
│   ├── /pricing (요금/크레딧 안내)
│   ├── /faq (자주 묻는 질문)
│   ├── /blog (SEO 콘텐츠 — v1.5)
│   ├── /policies
│   │   ├── /policies/terms (이용약관)
│   │   ├── /policies/privacy (개인정보처리방침)
│   │   ├── /policies/refund (환불정책)
│   │   └── /policies/credit (크레딧 운영 정책)
│   ├── /login (로그인)
│   └── /signup (회원가입)
│
├── [Authenticated — User 권한]
│   ├── /dashboard (홈 — 내 활동 요약)
│   │
│   ├── /apps (내 앱 — 개발자 모드)
│   │   ├── /apps/new (앱 등록)
│   │   ├── /apps/:id (앱 상세 / 매칭 진행 상황)
│   │   ├── /apps/:id/edit (앱 수정)
│   │   └── /apps/:id/boost (급구 결제)
│   │
│   ├── /testing (내 테스트 — 테스터 모드)
│   │   ├── /testing/discover (참여 가능 앱 둘러보기)
│   │   ├── /testing/active (진행 중인 테스트)
│   │   ├── /testing/history (완료/이력)
│   │   └── /testing/:matchId (테스트 상세 + 체크인)
│   │
│   ├── /credits (크레딧)
│   │   ├── /credits (잔액 + 내역)
│   │   ├── /credits/charge (충전)
│   │   ├── /credits/exchange (외부 전환 — Coming Soon)
│   │   └── /credits/refund (환불 신청)
│   │
│   ├── /urgent (급구 채널)
│   │
│   ├── /me (내 프로필)
│   │   ├── /me/profile (기본 정보)
│   │   ├── /me/devices (디바이스 관리)
│   │   ├── /me/notifications (알림 설정)
│   │   ├── /me/trust-score (Trust Score 상세)
│   │   ├── /me/security (계정/세션)
│   │   └── /me/withdraw (회원 탈퇴)
│   │
│   └── /support (도움말/문의)
│       ├── /support/contact (1:1 문의)
│       └── /support/report (신고)
│
└── [Admin — Admin 권한]
    └── /admin
        ├── /admin (운영 대시보드)
        ├── /admin/users (사용자 관리)
        ├── /admin/apps (앱 관리)
        ├── /admin/matches (매칭 모니터링)
        ├── /admin/payments (결제/환불)
        ├── /admin/reports (신고 검토 큐)
        ├── /admin/credits (크레딧 발행/회수)
        ├── /admin/notices (공지사항 관리)
        └── /admin/stats (통계)
```

---

## 3. 글로벌 네비게이션 (GNB)

### Guest 상태

| 위치 | 메뉴 |
|---|---|
| 좌측 로고 | Tester Match |
| 중앙 | How it Works · Pricing · FAQ · Blog |
| 우측 | 로그인 · **회원가입 (CTA)** |

### User 로그인 상태

| 위치 | 메뉴 |
|---|---|
| 좌측 로고 | Tester Match |
| 중앙 | 대시보드 · 내 앱 · 테스트하기 · 급구 · 크레딧 |
| 우측 | 알림(🔔) · 프로필 드롭다운(닉네임 + 잔액) |

**프로필 드롭다운 (펼침)**
- 내 프로필
- 알림 설정
- Trust Score
- 도움말
- 로그아웃

### Admin 로그인 상태
- GNB에 "관리자" 별도 메뉴 추가 (관리자 권한 보유 시에만 노출)

---

## 4. 푸터 (모든 페이지 공통)

| 분류 | 메뉴 |
|---|---|
| Service | How it Works, Pricing, FAQ, Blog |
| Company | About, Contact, Careers (v2) |
| Legal | Terms, Privacy, Refund, Credit Policy |
| Community | Discord, Twitter/X, Reddit |
| 우측 하단 | © 2026 Tester Match. 사업자번호·연락처 |

---

## 5. 페이지별 핵심 정보 (One-liner)

### Public Pages

| 경로 | 페이지 | 핵심 한 줄 | CTA |
|---|---|---|---|
| `/` | 랜딩 홈 | "Get 12 testers in 7 days" | 회원가입 |
| `/how-it-works` | 서비스 소개 | 품앗이 매커니즘 + 14일 추적 설명 | 회원가입 |
| `/pricing` | 요금 안내 | 일반 풀(무료) vs 급구(KRW 39,000) | 회원가입 |
| `/faq` | FAQ | 정책·결제·기술 카테고리별 FAQ | — |
| `/blog` | 블로그 | SEO 콘텐츠 (Google Play 가이드 등) | 회원가입 |
| `/login` | 로그인 | Google OAuth, 이메일 매직 링크 | 회원가입 안내 |
| `/signup` | 회원가입 | 약관 동의 + Google OAuth | — |
| `/policies/terms` | 이용약관 | 법적 문서 | — |
| `/policies/privacy` | 개인정보 | 법적 문서 | — |
| `/policies/refund` | 환불정책 | 7일 미사용 100% 환불 등 | — |
| `/policies/credit` | 크레딧 운영 정책 | 적립/만료/외부 전환 정책 | — |

### User Pages

| 경로 | 페이지 | 핵심 한 줄 |
|---|---|---|
| `/dashboard` | 대시보드 | 내 앱 진행 + 테스트 진행 + 크레딧 잔액 한 눈에 |
| `/apps` | 내 앱 목록 | 등록한 앱 카드 리스트, 상태별 필터 |
| `/apps/new` | 앱 등록 | 4단계 폼 (정보→링크→옵션→확인) |
| `/apps/:id` | 앱 상세 | 매칭 진행률, 14일 카운트, 보충 알림 |
| `/apps/:id/boost` | 급구 결제 | 가격 옵션 → 토스페이먼츠 결제 (v1) / Stripe (v2) |
| `/testing/discover` | 참여 가능 앱 | 카드 리스트, 카테고리/시간대 필터 |
| `/testing/active` | 진행 중 테스트 | 14일 진행률, 오늘 체크인 버튼 |
| `/testing/history` | 테스트 이력 | 완료/포기/페널티 기록 |
| `/testing/:matchId` | 테스트 상세 | 1탭 체크인, 스크린샷 업로드(랜덤) |
| `/credits` | 크레딧 | 잔액 + 내역, 필터, CSV |
| `/credits/charge` | 충전 | KRW 1:1 충전, 결제 수단 선택 |
| `/credits/exchange` | 외부 전환 | "Coming Soon" 배너, 알림 신청 |
| `/credits/refund` | 환불 신청 | 자동 승인 (7일 미사용분) |
| `/urgent` | 급구 채널 | 결제된 앱 우선 노출, 푸시 ON 토글 |
| `/me/*` | 프로필/설정 | 6개 서브 페이지 |
| `/support/contact` | 1:1 문의 | 폼 제출 → 이메일 회신 |
| `/support/report` | 신고 | 매칭/사용자 신고 |

### Admin Pages

| 경로 | 페이지 | 핵심 |
|---|---|---|
| `/admin` | 운영 대시보드 | 오늘의 매칭/결제/신규가입/장애 |
| `/admin/users` | 사용자 관리 | 검색·정지·복구·강제 로그아웃 |
| `/admin/apps` | 앱 관리 | 부적절 앱 강제 비활성화 |
| `/admin/matches` | 매칭 모니터링 | 진행 중/실패/보충 큐 |
| `/admin/payments` | 결제·환불 | 거래 검색, 수동 환불 |
| `/admin/reports` | 신고 큐 | 신고 검토 + Trust Score 조정 |
| `/admin/credits` | 크레딧 운영 | 발행/회수/이벤트 지급 |
| `/admin/notices` | 공지 관리 | 사이트 배너/팝업 |
| `/admin/stats` | 통계 | DAU/매칭/매출 차트 |

---

## 6. 모바일 메뉴 (Bottom Tab Bar — 모바일 웹 전용)

> 모바일 환경에서는 GNB를 햄버거 + 하단 탭 바로 분리.

| 위치 | 메뉴 | 아이콘 |
|---|---|---|
| 1 | 홈 (대시보드) | 🏠 |
| 2 | 내 앱 | 📱 |
| 3 | **테스트하기 (가운데, 강조)** | ➕ |
| 4 | 크레딧 | 💎 |
| 5 | 내 정보 | 👤 |

---

## 7. 진입 후 첫 화면 (Empty State)

빈 상태(데이터 0건)에서 무엇을 보여줄지 명확히 정의:

| 페이지 | Empty State 메시지 | CTA |
|---|---|---|
| `/dashboard` (신규) | "환영합니다. 첫 앱을 등록하거나 첫 테스트를 시작해보세요" | 앱 등록 / 테스트 시작 (양쪽 CTA) |
| `/apps` (앱 0개) | "등록한 앱이 없습니다" | 첫 앱 등록 |
| `/testing/active` (진행 0건) | "진행 중인 테스트가 없습니다" | 둘러보기 |
| `/credits` (잔액 0) | "크레딧이 없습니다. 테스트로 적립하거나 충전하세요" | 둘러보기 / 충전 |

---

## 8. 페이지 우선순위 (개발 순서)

| Phase | 페이지 |
|---|---|
| Phase 1 (Week 1~4) | `/`, `/login`, `/signup`, `/dashboard`, `/me/profile`, `/policies/*` |
| Phase 2 (Week 5~7) | `/apps/*`, `/testing/discover`, `/testing/active`, `/testing/:matchId` |
| Phase 3 (Week 8~10) | `/credits/*`, `/apps/:id/boost`, `/urgent` |
| Phase 4 (Week 11~12) | `/admin/*`, `/support/*`, `/faq`, `/how-it-works`, `/pricing` |

---

## 9. URL 작명 규칙

- 케밥 케이스 (`how-it-works`)
- 동사보다는 명사 (`/credits/charge` ✓ vs `/charge-credits` ✗)
- 단수/복수: 리소스 컬렉션은 복수 (`/apps`, `/credits`)
- ID는 정수 또는 nanoid (UUID는 너무 길어서 미사용)
- 영문 소문자, 한글 URL 사용 안 함 (SEO·공유 호환성)
