# 디자인 컨셉 (Design Concept) — Tester Match v1

> 작성일: 2026-05-04 / Version: v0.1
> 참고 사이트: [ncloud.com](https://www.ncloud.com/)
> 시각 미리보기: [design_preview.html](./design_preview.html) — 브라우저로 열어 컬러·컴포넌트 확인

---

## 0. 디자인 철학 (Design Principles)

### 우리 서비스의 정체성

| 키워드 | 의미 | 디자인 표현 |
|---|---|---|
| **신뢰 (Trust)** | 결제·시간·앱을 맡기는 서비스 | 안정적인 단색, 정돈된 그리드 |
| **속도 (Speed)** | 12명을 빠르게 모아주는 핵심 | 명확한 CTA, 빠른 응답 (스켈레톤·로딩 미니멀) |
| **동료 (Peer)** | 개발자 ↔ 개발자 품앗이 | 따뜻한 액센트, 친근한 일러스트 |
| **단순 (Simple)** | 복잡한 매칭을 한 번에 해결 | 화이트 스페이스, 카드 한 단계 깊이 |

### 참고 사이트(NCP)에서 가져올 것 / 가져오지 않을 것

| 가져올 것 | 가져오지 않을 것 |
|---|---|
| 화이트 베이스 + 라이트 그레이 섹션 분리 | NCP 특유의 그린/네이비 (브랜드 충돌) |
| 큰 히어로 영역 + 추상 일러스트 | 인프라 기업 특유의 무거운 톤 |
| 카드 그리드 기반 서비스 소개 | 메가메뉴 (우리는 메뉴가 단순) |
| 정돈된 타이포 위계 (H1>H2>본문) | 다단 푸터 (우리는 미니멀하게) |

---

## 1. 컬러 시스템 (Color System)

### 1.1 컨셉 컬러 — Trust Blue + Spark Coral

신뢰감을 주는 차분한 블루를 메인으로, 매칭·완주의 순간을 강조하는 따뜻한 코랄을 액센트로 사용한다.

| 역할 | 이름 | HEX | 용도 |
|---|---|---|---|
| **Primary** | Trust Blue 600 | `#2563EB` | 메인 CTA, 링크, 활성 탭 |
| Primary Hover | Trust Blue 700 | `#1D4ED8` | 버튼 hover |
| Primary Active | Trust Blue 800 | `#1E40AF` | 버튼 active |
| Primary Light | Trust Blue 50 | `#EFF6FF` | 배경 강조, 알림 박스 |
| **Accent** | Spark Coral 500 | `#FF6B5B` | Boost(급구), 매칭 완료 강조 |
| Accent Hover | Spark Coral 600 | `#E85546` | |
| Accent Light | Spark Coral 50 | `#FFF1EE` | Boost 배지 배경 |

### 1.2 시맨틱 컬러 (Semantic)

| 의미 | 이름 | HEX | 용도 |
|---|---|---|---|
| Success | Mint Green 500 | `#10B981` | 14일 완주, 결제 성공 |
| Warning | Amber 500 | `#F59E0B` | SLA 임박, 미체크인 경고 |
| Danger | Crimson 500 | `#EF4444` | 페널티, 환불 실패 |
| Info | Sky Blue 500 | `#0EA5E9` | 정보 안내, 새 기능 배지 |

### 1.3 뉴트럴 (Neutral) — Slate 계열

| 단계 | HEX | 용도 |
|---|---|---|
| Neutral 950 | `#020617` | 본문 텍스트 (다크) |
| Neutral 900 | `#0F172A` | 헤딩 |
| Neutral 700 | `#334155` | 본문 |
| Neutral 500 | `#64748B` | 보조 텍스트 |
| Neutral 300 | `#CBD5E1` | 비활성 상태, 보더 강 |
| Neutral 200 | `#E2E8F0` | 보더 |
| Neutral 100 | `#F1F5F9` | 섹션 배경 (라이트 그레이) |
| Neutral 50 | `#F8FAFC` | 카드 hover 배경 |
| White | `#FFFFFF` | 메인 배경 |

### 1.4 컬러 사용 비율 (60-30-10 원칙)

| 비율 | 영역 | 컬러 |
|---|---|---|
| 60% | 메인 배경, 카드 | White / Neutral 50 |
| 30% | 보조 영역 (섹션 분리, 보더) | Neutral 100 / Neutral 200 |
| 10% | CTA, 강조, 액센트 | Trust Blue 600 (주) + Spark Coral 500 (보) |

### 1.5 다크 모드 — v2로 보류

v1은 라이트 모드만 지원. 다만 CSS 변수 구조는 v1부터 적용해 v2 다크 모드 추가 시 토큰만 교체.

---

## 2. 타이포그래피 (Typography)

### 2.1 폰트 패밀리

| 용도 | 폰트 | 폴백 |
|---|---|---|
| 본문/UI | **Pretendard Variable** | -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif |
| 숫자 (잔액·통계) | **Pretendard Variable** + tabular-nums | — |
| 코드 | **JetBrains Mono** | "D2Coding", monospace |
| 영문 디스플레이 (히어로) | **Inter** | system-ui |

> Pretendard는 한글·영문 모두 자연스럽고 무료(오픈소스). NCP·토스·당근에서 모두 사용. CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css`

### 2.2 타입 스케일 (1.25 비율)

| 토큰 | 크기 (px) | line-height | weight | 용도 |
|---|---|---|---|---|
| display-1 | 60 | 1.1 | 700 | 히어로 헤드라인 |
| display-2 | 48 | 1.15 | 700 | 섹션 타이틀 (대) |
| h1 | 36 | 1.2 | 700 | 페이지 제목 |
| h2 | 28 | 1.3 | 600 | 섹션 제목 |
| h3 | 22 | 1.4 | 600 | 카드 제목 |
| h4 | 18 | 1.4 | 600 | 서브 헤딩 |
| body-lg | 18 | 1.6 | 400 | 본문 (소개 페이지) |
| body | 16 | 1.6 | 400 | 본문 (기본) |
| body-sm | 14 | 1.5 | 400 | 보조 텍스트 |
| caption | 12 | 1.4 | 500 | 라벨, 메타 |
| code | 14 | 1.5 | 400 | 코드 |

### 2.3 타이포 사용 규칙

- **모바일에서 전체 80% 스케일**: display-1 60→48, h1 36→28
- **숫자는 항상 tabular-nums**: 잔액·카운트가 흔들리지 않도록
- **줄바꿈 금지 클래스**: `text-balance` (헤드라인은 미관상 균형 잡기)
- **외국어(영어) 헤딩**: Inter 사용 — 한글과 폰트가 달라도 시각 위계로 구분

---

## 3. 그리드와 레이아웃

### 3.1 그리드

| 디바이스 | 컨테이너 max-width | 컬럼 | 거터 |
|---|---|---|---|
| Mobile (~640px) | 100% | 4 | 16px |
| Tablet (640~1024) | 95% | 8 | 24px |
| Desktop (1024~1440) | 1200px | 12 | 24px |
| Wide (1440+) | 1280px | 12 | 32px |

### 3.2 간격 토큰 (4px 단위)

| 토큰 | px |
|---|---|
| 0 | 0 |
| 1 | 4 |
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 6 | 24 |
| 8 | 32 |
| 12 | 48 |
| 16 | 64 |
| 24 | 96 |
| 32 | 128 |

### 3.3 모서리 (Radius)

| 토큰 | px | 용도 |
|---|---|---|
| sm | 6 | 배지, 작은 인풋 |
| md | 10 | 버튼, 카드 |
| lg | 16 | 모달, 큰 카드 |
| xl | 24 | 히어로 일러스트 컨테이너 |
| full | 9999 | 칩, 아바타 |

### 3.4 그림자 (Shadow)

| 토큰 | 값 | 용도 |
|---|---|---|
| sm | `0 1px 2px rgba(15,23,42,0.05)` | 입력 필드 |
| md | `0 4px 12px rgba(15,23,42,0.06)` | 카드 기본 |
| lg | `0 12px 32px rgba(15,23,42,0.08)` | 카드 hover, 모달 |
| focus | `0 0 0 3px rgba(37,99,235,0.25)` | 포커스 링 |

> NCP 톤 따라 **무거운 그림자 회피** — 부드럽고 옅게.

---

## 4. 컴포넌트 가이드 (핵심 8종)

### 4.1 Button

| Variant | 배경 | 텍스트 | 보더 |
|---|---|---|---|
| primary | Trust Blue 600 | White | none |
| accent | Spark Coral 500 | White | none |
| secondary | White | Neutral 900 | Neutral 200 |
| ghost | transparent | Trust Blue 600 | none |
| danger | Crimson 500 | White | none |

**상태**: hover (10% 어둡게) / active (20% 어둡게) / disabled (40% 투명) / loading (스피너 + 텍스트 유지)
**크기**: sm 32px, md 40px, lg 48px (height)

### 4.2 Card

기본 카드:
- 배경: White
- 보더: 1px Neutral 200
- 모서리: lg(16px) 또는 md(10px)
- 패딩: 24px
- hover: shadow lg + 1px translate up

**앱 카드 (참여 가능 앱 리스트용)**:
- 좌측 64x64 앱 아이콘
- 우측 상단 Boost 배지(있는 경우, Spark Coral 50 배경)
- 본문 2줄, ellipsis
- 하단 메타: 카테고리·보상 크레딧·14일 종료 예정일

### 4.3 Input / Form

- 높이 40px (md), 48px (lg)
- 보더 1px Neutral 200, focus 시 Trust Blue 600 + focus shadow
- placeholder는 Neutral 500
- 에러 시: 보더 Crimson 500 + 하단 메시지

### 4.4 Badge / Chip

| 종류 | 배경 | 텍스트 |
|---|---|---|
| Boost | Spark Coral 50 | Spark Coral 600 |
| Success | #ECFDF5 | Mint Green 600 |
| Pending | Neutral 100 | Neutral 700 |
| New | Sky Blue 50 | Sky Blue 600 |

### 4.5 Toast / Alert

- 우측 상단 슬라이드인 (4초 자동 종료)
- 시맨틱 컬러 + 아이콘 (lucide-react)
- 액션 버튼 1개 옵션

### 4.6 Modal

- 오버레이: rgba(15,23,42,0.5) + backdrop-blur(8px)
- 모서리 lg, 패딩 32px
- 모바일에서는 하단 시트(bottom sheet)로 전환

### 4.7 Progress (14일 카운트 핵심 컴포넌트)

가장 중요한 시각 컴포넌트.
- 14단계 점/원 형태로 진행률 표시
- 완료된 일자는 Mint Green, 오늘은 Trust Blue 펄스 애니메이션, 미완은 Neutral 200
- 옆에 "Day 7 / 14" 텍스트

### 4.8 Empty State

빈 화면(데이터 0건):
- 중앙 정렬 추상 일러스트(SVG)
- 헤딩 + 설명 + CTA 1개
- 친근한 톤("아직 등록한 앱이 없어요")

---

## 5. 일러스트레이션 / 아이콘 / 이미지

### 5.1 아이콘

- **lucide-react** (오픈소스, MIT) — Tailwind와 가장 잘 어울림
- 사이즈: 16/20/24px 고정
- 컬러: 기본 Neutral 700, 강조 시 Trust Blue 600

### 5.2 일러스트

- **추상 도형 + 그라디언트** (NCP 톤)
- Trust Blue + Spark Coral의 부드러운 그라디언트
- **사용자 얼굴/캐릭터 표현 X** — 글로벌 확장 시 문화적 부담 회피
- 추천 소스: 무료 → [unDraw](https://undraw.co/) (컬러 커스터마이징 가능), [Storyset](https://storyset.com/)
- 자체 제작 시 Figma + 단순한 도형 조합

### 5.3 앱 아이콘 / 사용자 아바타

- 모서리 12px (앱 아이콘) / 99999 (사용자 아바타)
- placeholder: 닉네임 첫 글자 + 자동 생성 배경 컬러

---

## 6. 모션 (Motion)

| 동작 | duration | easing | 비고 |
|---|---|---|---|
| 버튼 hover | 150ms | ease-out | |
| 모달 등장 | 200ms | ease-out | scale 0.95→1 + fade |
| Toast 슬라이드 | 250ms | spring | |
| 페이지 전환 | 200ms | ease-in-out | fade only |
| 14일 카운트 펄스 | 2000ms | ease-in-out | infinite |

> **모션 줄이기 옵션 (prefers-reduced-motion) 반드시 대응** — 접근성 + Apple 기기 호환

---

## 7. 메인 페이지 (`/`) 구성안

NCP 메인 페이지의 구조를 참고하되, 우리 서비스에 맞게 단순화.

### 7.1 섹션 흐름

```
[1] Hero  ─── 큰 헤드라인 + 추상 일러스트 + 듀얼 CTA
[2] How It Works  ─── 3단계 아이콘 + 텍스트 (등록 → 매칭 → 완주)
[3] Why Tester Match  ─── 4가지 차별화 (Trust Score, Auto Reminder, Time-zone, SLA)
[4] Pricing Snapshot  ─── 무료 / Boost / Pro 3컬럼
[5] Stats / Trust  ─── "지금까지 N개 앱 출시 도와드림" 숫자 강조
[6] FAQ Top 5  ─── 아코디언
[7] Final CTA  ─── 큰 회원가입 박스
[8] Footer  ─── 미니멀 (4컬럼)
```

### 7.2 Hero 섹션 상세

```
┌────────────────────────────────────────────────┐
│ [BADGE] Closed Testing 12명 14일이 막막한가요? │
│                                                │
│ 7일 안에 12명의                                │
│ 활성 테스터를 모아드립니다.                    │
│                                                │
│ 인디 개발자들이 서로의 앱을 테스트해주는       │
│ 글로벌 품앗이 매칭 플랫폼.                     │
│                                                │
│ [시작하기 — Trust Blue]  [어떻게 작동하나요?]  │
│                                                │
│ ★★★★★ 4.9 / 200+ developers (가짜 데이터 X)   │
└────────────────────────────────────────────────┘
                                      [추상 일러스트 ↗]
```

좌측 텍스트 / 우측 일러스트 (2:1.5 비율). 모바일에서는 일러스트가 위.

### 7.3 일러스트 컨셉 (Hero)

- 추상 도형으로 "12명의 사람이 원형으로 연결된" 모티프
- Trust Blue (메인 노드) + Spark Coral (강조 노드 1개) + Neutral 300 (연결선)
- 부드러운 그라디언트 배경 (Trust Blue 50 → White)
- SVG로 자체 제작 권장 (이미지 파일보다 가볍고 컬러 변경 쉬움)

---

## 8. 서비스 소개 페이지 (`/how-it-works`) 구성안

> 사용자 요청대로 메인 페이지와 동일한 톤·이미지로 통일감 부여.

### 8.1 섹션 흐름

```
[1] Hero (단순)  ─── "이렇게 작동합니다" + 메인과 동일한 일러스트 변형
[2] Step 1 등록  ─── 일러스트 + 설명 + 스크린샷 목업
[3] Step 2 매칭  ─── 일러스트 + 설명
[4] Step 3 14일 유지  ─── 일러스트 + 설명
[5] Step 4 완주 → 적립  ─── 일러스트 + 설명
[6] CTA 재등장  ─── "지금 바로 시작하기"
```

각 Step:
- 좌우 번갈아 배치 (zig-zag)
- 좌측 일러스트 / 우측 텍스트 → 다음 단계는 반대
- 모든 일러스트는 메인 페이지와 같은 컬러 시스템·도형 언어 사용

### 8.2 Step 일러스트 4종 (제작 가이드)

| Step | 모티프 | 메인 컬러 |
|---|---|---|
| 등록 | 박스에서 앱 아이콘이 떠오르는 형태 | Trust Blue 600 + Coral 200 |
| 매칭 | 두 노드가 빛으로 연결되는 형태 | Trust Blue 500 + Mint 400 |
| 14일 유지 | 14개 점이 점점 채워지는 형태 (메인의 ProgressDot와 같은 시각 언어) | Mint Green 500 |
| 완주 | 트로피/체크/별 등 추상화 | Spark Coral 500 |

> **일러스트 4종은 같은 작가/같은 라이브러리에서 통일되게 제작**해야 시각 일관성이 생깁니다. 외주 시 "동일 톤·동일 두께·동일 그라디언트" 명시.

---

## 9. Tailwind CSS 설정 코드 (바로 적용 가능)

### 9.1 `tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB", // Trust Blue 600 — 메인
          700: "#1D4ED8",
          800: "#1E40AF",
        },
        accent: {
          50:  "#FFF1EE",
          500: "#FF6B5B", // Spark Coral 500 — 액센트
          600: "#E85546",
        },
        success: { 500: "#10B981", 600: "#059669" },
        warning: { 500: "#F59E0B" },
        danger:  { 500: "#EF4444" },
        info:    { 500: "#0EA5E9" },
      },
      fontFamily: {
        sans: ["Pretendard Variable", "-apple-system", "Apple SD Gothic Neo",
               "Malgun Gothic", "sans-serif"],
        mono: ["JetBrains Mono", "D2Coding", "monospace"],
      },
      fontSize: {
        "display-1": ["3.75rem", { lineHeight: "1.1", fontWeight: "700" }],
        "display-2": ["3rem",    { lineHeight: "1.15", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "1rem",
        xl: "1.5rem",
      },
      boxShadow: {
        sm:  "0 1px 2px rgba(15,23,42,0.05)",
        md:  "0 4px 12px rgba(15,23,42,0.06)",
        lg:  "0 12px 32px rgba(15,23,42,0.08)",
        focus: "0 0 0 3px rgba(37,99,235,0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 9.2 글로벌 CSS (`app/globals.css`)

```css
@import "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg: #FFFFFF;
  --color-bg-soft: #F8FAFC;
  --color-text: #0F172A;
  --color-text-soft: #64748B;
}

html { scroll-behavior: smooth; }
body {
  font-family: "Pretendard Variable", -apple-system, "Apple SD Gothic Neo",
               "Malgun Gothic", sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "tnum"; /* 숫자 tabular */
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

---

## 10. 디자인 토큰 검증 (접근성 포함)

| 조합 | 대비비 (WCAG) | 상태 |
|---|---|---|
| Trust Blue 600 on White | 4.6:1 | AA Large + AA Normal |
| Spark Coral 500 on White | 3.1:1 | AA Large only — 본문 X |
| Neutral 700 on White | 9.3:1 | AAA |
| White on Trust Blue 600 | 4.6:1 | AA Normal |
| White on Spark Coral 500 | 3.1:1 | AA Large only |

→ 액센트 컬러(Coral)는 **버튼·배지에만 사용, 본문 텍스트로는 미사용**.

---

## 11. 디자인 도구 / 자산 관리

| 항목 | 도구 | 비용 |
|---|---|---|
| 와이어프레임 | Figma (무료) | 무료 |
| 디자인 시스템 | Figma + Token Studio (선택) | 무료 |
| 일러스트 제작 | Figma 또는 Illustrator | Figma 무료 |
| 아이콘 | lucide-react (npm) | 무료 |
| 폰트 | Pretendard CDN | 무료 |
| 무료 일러스트 | unDraw, Storyset | 무료 |
| 컬러 검증 | Coolors / Adobe Color | 무료 |
| 접근성 검증 | WebAIM Contrast Checker | 무료 |

---

## 12. 적용 우선순위

| 단계 | 적용 |
|---|---|
| Week 1 | Tailwind 설정, 글로벌 폰트, 기본 컴포넌트 5종 |
| Week 2 | 메인 페이지 Hero + Footer |
| Week 3~4 | 메인 페이지 전 섹션 + How It Works |
| Week 5+ | 대시보드·앱·테스트 화면들 (디자인 시스템 활용) |
| Week 11 | Beta 피드백 받고 컬러·톤 미세 조정 |
| Week 12 | 일러스트 4종 외주 발주 또는 자체 제작 마감 |

---

## 13. Open Decisions

- [ ] 브랜드명 "Tester Match" 확정 → 로고 디자인 (워드마크 + 심볼)
- [ ] Pretendard 사용 라이선스 확인 (오픈소스 OFL — 상업 OK)
- [ ] 일러스트 자체 제작 vs unDraw 커스텀 vs 외주 (예산 약 50~150만원)
- [ ] 다크 모드 v2 도입 시점 (사용자 요청 누적 시)
- [ ] Spark Coral 채도 미세 조정 (컬러블라인드 검증)

---

## 14. 다음 단계 권장

본 문서로 컬러·타이포·컴포넌트는 정의됐으나, **실제 화면 와이어프레임**이 다음 산출물로 가장 시급합니다:

1. **메인 페이지 와이어프레임** (Figma 또는 Excalidraw)
2. **대시보드 화면** (개발자/테스터 모드)
3. **앱 등록 폼** (4단계)
4. **14일 진행 화면** (가장 중요한 UI 컴포넌트)

요청 주시면 Figma 가이드와 함께 와이어프레임 텍스트 명세를 별도 문서로 만들어드립니다.

---

## 15. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| v0.1 | 2026-05-04 | 초안. NCP 톤 차용 + Trust Blue / Spark Coral 컬러 시스템 정의 |
