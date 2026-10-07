# Tester Match 디자인 개편 — C안 「담백한 영수증」 구현 의뢰 프롬프트

> 사용법: 이 파일 전체와 `reference/home-c.html` 을 개발자(사람 또는 AI 코딩 에이전트)에게 그대로 전달한다.
> 리포에 접근할 수 있는 에이전트라면 리포 루트(`tester-match/`)에서 연 세션에 붙여넣고, 레퍼런스 파일은 `03-output/design/reference/` 아래에 둔다.
> 전제: 2026-10-07 「전체 디자인 개편 의뢰 프롬프트」(이하 *원 브리프*)의 단계 1에서 운영자가 **C안**을 선택했다. 이 문서는 그 단계 2(상세화)와 구현을 한 번에 맡기는 문서다. 원 브리프 §5(바꾸면 안 되는 것)는 이 문서보다 우선한다.

---

## 1. 당신의 역할과 이번 작업의 범위

당신은 **Tester Match** 웹사이트(Next.js 15 App Router + React 19 + Tailwind CSS v4)에 C안 디자인을 적용하는 프론트엔드 개발자입니다.

- 디자인 방향은 이미 정해졌습니다. **새 콘셉트를 제안하지 않습니다.** 레퍼런스(`reference/home-c.html`)의 시각 언어를 토큰·컴포넌트로 추출하고, 그 토큰과 컴포넌트로 페이지를 순서대로 옮깁니다.
- 레퍼런스는 **홈(`/`) 한 장**입니다. 나머지 페이지는 레퍼런스에서 추출한 토큰·컴포넌트·레이아웃 원칙(§3~§5)을 따라 만듭니다. 레퍼런스에 없는 요소가 필요하면 §5의 원칙으로 만들고, 애매하면 "결정 필요" 목록으로 남기고 가장 보수적인 쪽(흑백 + 괘선)을 택해 진행합니다.
- 기능·데이터·라우팅·API·결제 로직은 건드리지 않습니다. 화면의 숫자는 기존 코드 상수에서 가져옵니다(하드코딩 금지).

## 2. C안의 시각 언어 (레퍼런스에서 읽어야 할 것)

한 줄 콘셉트: **"영수증처럼 전부 공개하는, 흑백에 강조색 하나."**
무드 키워드: 정직한 · 담백한 · 성숙한.

| 요소 | C안의 규칙 | 지금 사이트와 달라지는 점 |
|---|---|---|
| 바탕 | 순백 `#FFFFFF`. 섹션을 색 바탕으로 나누지 않고 **1px / 1.5px 먹색 괘선**으로 나눈다 | 회색 카드 그리드 반복 제거 |
| 글자색 | 먹 `#111111`, 본문 보조 `#444444`, 캡션 `#555555` (이보다 밝은 회색 글자 금지) | neutral-400/500 캡션 제거 |
| 강조색 | **딱 하나** `#C8371F`(버밀리언). 급구 배지, 환불 표시, 포커스 링, 링크 hover, 섹션 번호에만 쓴다 | trust 파랑·spark 코랄 폐기 |
| 의미색 | 완료 `#1F7A4D`, 주의 `#8A4B00`, 오류 `#9F2B17`. 배지·상태 글자에만, 넓은 면에는 쓰지 않는다 | amber 상자 남용 제거 |
| 모서리 | **0px**. 버튼·카드·배지 전부 직각. 예외 없음 | `rounded-2xl` 제거 |
| 그림자 | 없음. 깊이는 테두리 두께(1px/1.5px)와 먹색 면 반전으로만 표현 | shadow 제거 |
| 제목 글꼴 | **Hahmlet**(세리프, Google Fonts, OFL) 600 | — |
| 본문 글꼴 | **Pretendard Variable**(기존 CDN 유지) 400/500/700 | 유지 |
| 숫자·레이블 | **JetBrains Mono** 500, `tabular-nums`. 금액·일수·단계 번호·영수증 항목·푸터 사업자번호 | `.tabular` 를 mono 로 승격 |
| 한글 조판 | `word-break: keep-all`, 본문 `line-height: 1.65`, 제목 `1.18~1.3`, 제목 `letter-spacing: -0.02em` | — |
| 버튼 | 사각형, 최소 높이 54px(히어로)/48px(일반)/44px(인라인), 1차 = 먹색 면·흰 글자, 2차 = 흰 면·1.5px 먹색 테두리, 3차 = 글자 + 밑줄 1.5px | — |
| 아이콘 | 인라인 stroke SVG(1.7~2px). **이모지 금지**. 아이콘 세트는 [Lucide](https://lucide.dev) (ISC) 사용 | 💰🔥✅ 제거 |
| 영수증 모티프 | 가격·쓰임·환불처럼 **돈이 오가는 정보는 전부 "영수증" 컴포넌트**로 보여준다: 1.5px 테두리, 점선 구분, mono 항목/값 양끝 정렬 | 결제·보상 화면 톤 통일 |
| 반응형 | 375px에서 가로 스크롤 금지. 2열은 `repeat(auto-fit, minmax(min(440px,100%),1fr))` 식으로 자연 붕괴. 헤더 메뉴는 760px 이하에서 햄버거 + 하단 탭 | — |

## 3. 디자인 토큰 — `globals.css` 의 `@theme` 에 그대로 붙일 것

```css
@theme {
  /* 면 */
  --color-surface-0: #FFFFFF;      /* 페이지 바탕 */
  --color-surface-1: #F4F4F4;      /* 법적 고지 상자, 표 머리글 */
  --color-surface-ink: #111111;    /* 반전 섹션(크레딧 규칙 등) */

  /* 글자·선 */
  --color-ink-900: #111111;        /* 제목, 본문 강조, 괘선 */
  --color-ink-700: #444444;        /* 본문 */
  --color-ink-600: #555555;        /* 캡션, 레이블 — 글자색 최소 밝기 */
  --color-ink-300: #BBBBBB;        /* 반전 섹션 위 보조 글자 */
  --color-ink-200: #DDDDDD;        /* 비활성 테두리 */
  --color-ink-on-ink: #FFFFFF;     /* 먹색 면 위 글자 */

  /* 강조 — 한 가지 */
  --color-accent-600: #C8371F;
  --color-accent-700: #9F2B17;     /* hover / 오류 */
  --color-accent-50:  #FBECE8;     /* 주의 상자 바탕(연함) */

  /* 의미 */
  --color-success-700: #1F7A4D;
  --color-success-50:  #E8F3EC;
  --color-warning-700: #8A4B00;
  --color-warning-50:  #FBF1E3;
  --color-danger-700:  #9F2B17;
  --color-danger-50:   #FBECE8;

  /* 글꼴 */
  --font-display: "Hahmlet", "Nanum Myeongjo", "Apple SD Gothic Neo", serif;
  --font-sans: "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;

  /* 글자 크기 / 줄 간격 */
  --text-display: clamp(36px, 5.4vw, 66px); --text-display--line-height: 1.18; --text-display--letter-spacing: -0.02em;
  --text-h1: 30px; --text-h1--line-height: 1.3; --text-h1--letter-spacing: -0.01em;
  --text-h2: 26px; --text-h2--line-height: 1.3;
  --text-h3: 20px; --text-h3--line-height: 1.4;
  --text-lead: 18px; --text-lead--line-height: 1.75;
  --text-body: 15px; --text-body--line-height: 1.65;
  --text-small: 13px; --text-small--line-height: 1.6;
  --text-caption: 12px; --text-caption--line-height: 1.6;

  /* 반경 · 선 · 간격 */
  --radius-none: 0px;              /* 전역 radius 는 0 하나뿐 */
  --border-width-hair: 1px;
  --border-width-rule: 1.5px;
  --spacing-section: 56px;         /* 데스크톱 섹션 상하 */
  --spacing-section-sm: 40px;      /* 모바일 */
  --spacing-gutter: 20px;          /* 좌우 여백(375px 기준) */
  --container-page: 1200px;
}
```

전역 스타일(`@layer base`)에 추가: `body { font-family: var(--font-sans); color: var(--color-ink-900); background: var(--color-surface-0); line-height: 1.65; word-break: keep-all; -webkit-font-smoothing: antialiased; }`, `:focus-visible { outline: 3px solid var(--color-accent-600); outline-offset: 3px; }`, `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`.

글꼴 로드: `app/layout.tsx` 의 `<head>` 에 `https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600&family=JetBrains+Mono:wght@500&display=swap` 한 줄 추가. Pretendard CDN 은 그대로. (`next/font/google` 로 바꿔도 되지만 둘 중 하나로 통일.)

### 기존 토큰 → 새 토큰 대응표

| 기존 (`@theme`) | 쓰이던 곳 | 새 토큰 |
|---|---|---|
| `trust-600` (#2563eb) 주 버튼·링크 | 1차 버튼, 링크 | 버튼 → `ink-900` 면 / 링크 → `ink-900` + 밑줄, hover `accent-600` |
| `trust-50~100` 연파랑 바탕 | 안내 상자, 강조 칩 | `surface-1` 또는 테두리만 |
| `spark` (#ff6b5b) 급구 | 급구 배지·BOOST | `accent-600` (흰 글자 5.2:1) |
| `mint` (#10b981) 완료 | 완료 배지, 체크 | `success-700` (글자·아이콘만) |
| `amber` (#f59e0b) 경고·안내·법적 고지 | 노란 상자 전부 | 정보 → 괘선 상자 / 주의 → `warning-700`+`warning-50` / 법적 고지 → `surface-1`+mono |
| `crimson` (#ef4444) 오류 | 폼 오류, 실패 | `danger-700` |
| `sky` | 링크·보조 | 삭제 (쓰는 곳은 `ink-900`) |
| `neutral-*` 회색 글자 | 캡션 | `ink-600` 이하로 내려가지 않음 (`neutral-400/500` 글자 금지) |
| `rounded-2xl`, `shadow-*` | 카드 | 제거 → `border` 1px `ink-900` 또는 `ink-200` |

## 4. 레이아웃 원칙 (모든 페이지 공통)

1. **컨테이너**: `max-width: 1200px; margin: 0 auto; padding: 0 20px`. 섹션 사이는 색 바탕이 아니라 `border-top: 1px solid ink-900`.
2. **강약**: 한 페이지에 세리프 디스플레이 제목은 **하나**(히어로). 그 아래는 `h2` 세리프 26~30px, 그 아래는 산세리프. 모든 섹션을 카드 그리드로 만들지 않는다. 카드가 필요한 곳은 "영수증"과 "앱 카드" 둘뿐.
3. **숫자는 mono**: 금액, 인원, 일수, 크레딧, 단계 번호, 사업자번호, 전화. `font-variant-numeric: tabular-nums`.
4. **반전 섹션은 페이지당 최대 하나**(`surface-ink` 바탕, 흰 글자). 홈에서는 "크레딧 규칙"이 그 자리.
5. **모바일 375px**: 히어로 제목 36px, 버튼 전폭 세로 배치, 영수증 카드 전폭. 고정 하단 탭 바는 `padding-bottom: env(safe-area-inset-bottom)` 과 카카오톡 인앱 브라우저 하단 바를 고려해 **콘텐츠 하단 여백 88px** 확보.
6. **빈 상태 / 로딩 / 오류**는 한 컴포넌트(§5.11)로 통일한다.

## 5. 컴포넌트 명세 (`components/ui/*` 에 새로 만들거나 기존을 교체)

각 컴포넌트는 기본·hover·focus·disabled·loading·error 상태를 구현한다. 색은 §3 토큰만 쓴다.

| # | 컴포넌트 | 명세 | 기존 대응 |
|---|---|---|---|
| 5.1 | `Button` `variant="primary|secondary|text"` | primary: `bg ink-900 / text white`, hover `bg #000`, disabled `bg ink-200 text ink-600`; secondary: `bg white / border 1.5px ink-900`, hover `bg surface-1`; text: 밑줄 1.5px, hover `accent-600`. `size="lg(54)|md(48)|sm(44)"`. loading = 글자 자리에 mono "…" 스피너(SVG stroke), 폭 유지 | `components/button.tsx` 등 기존 버튼 전부 |
| 5.2 | `Badge` `tone="accent|ink|outline|success|warning|danger"` | 직각, `padding 4px 10px`, 12px 500. accent = 급구/BOOST(흰 글자). outline = "결제 오픈 대기"(1px ink-900 테두리, 흰 바탕) — 결제 오픈 후 **삭제될 요소이므로 `PaymentPendingBadge` 로 분리**. 상태 배지는 **반드시 글자 포함**(색만으로 전달 금지) | 주문·매칭 상태 칩, 신뢰도 ★ |
| 5.3 | `Receipt` | 1.5px ink-900 테두리, `padding 28px 26px`, 항목 행 = mono 14px 양끝 정렬, 구분선 = `border-top 1px dashed ink-900`. 슬롯: 머리(제목+배지), 메타(판매자·부가세 포함), 항목들, 쓰임 막대, 환불 항목, 꼬리(정책 링크). **급구 신청·결제·결제 완료·주문 콘솔·보상 화면의 금액 블록은 모두 이 컴포넌트** | 결제 요약 박스 |
| 5.4 | `MoneyUseBar` | 높이 12px, 1px ink-900 테두리, 왼쪽 63.6% `ink-900` 면(보상 최대 700), 오른쪽 36.4% 흰 면 + 1px 경계(운영 400). 아래 mono 레이블 두 개. `role="img"` + aria-label 로 수치 읽기. 값은 상수에서 계산 | 없음(신규) |
| 5.5 | `StatTile` | 레이블 12px ink-600 / 값 세리프 24px (mono 숫자 혼용 시 `font-mono`) / 상단 1.5px 괘선. 그리드로 3~4개 | 숫자 카드 |
| 5.6 | `Notice` `kind="info|caution|legal"` | info: 1px ink-900 테두리 + 원형 i 아이콘; caution: `warning-50` 바탕 + 1.5px `warning-700` **상단** 선 + 삼각 아이콘 + 제목 `warning-700`; legal: `surface-1` 바탕, mono 13px, 문서 아이콘, 테두리 없음. **왼쪽 색 테두리(left-border) 금지.** 세 종류를 한 화면에 섞어 쓰지 않도록 각 페이지에서 용도를 명시 | 노란 amber 상자 전부 |
| 5.7 | `AppCard` | 1px ink-900 테두리, 직각, 내부 `padding 20px`. 머리: 앱 이름(세리프 20px) + 배지(급구/맞테스트/유료 시트 n). 본문: 한 줄 설명 15px ink-700. 꼬리: mono "테스터 n/12 · 남은 n일" + 2차 버튼 44px. 유료 시트가 있으면 `accent-600` 1.5px 테두리로 승격 | 매칭 목록 카드 |
| 5.8 | `Steps` | `ol` 4열 auto-fit, 각 항목 상단 1.5px 괘선 + mono "01" + 굵은 제목 17px + 설명 14px | 진행 방식 섹션 |
| 5.9 | 폼: `Input` `Select` `Textarea` `Checkbox` `ConsentList` | 1px ink-900 테두리, 직각, 높이 48px, focus = 3px accent 링. 오류 = `danger-700` 테두리 + 아래 13px 오류 문구 + 아이콘. `ConsentList` = 동의 항목별 체크박스(44px 터치) + 정책 링크 + "전체 동의" 분리 | 결제·가입 폼 |
| 5.10 | `Table` | 머리글 `surface-1` 바탕 mono 12px, 행 구분 1px ink-200, 숫자 열 우측 정렬 mono. 모바일: `overflow-x: auto` 박스 안에서 가로 스크롤(페이지는 스크롤 금지) | 환불 기준 표, 주문 콘솔 |
| 5.11 | `EmptyState` `LoadingState` `ErrorState` | 중앙 정렬, 1px ink-900 상단 괘선, stroke 아이콘 32px, 제목 세리프 20px, 설명 14px, 1차 또는 2차 버튼 하나 | 페이지마다 제각각인 빈 상태 |
| 5.12 | `Toast` | 하단 중앙(모바일) / 우상단(데스크톱), 먹색 면 흰 글자, 직각, 아이콘 + 한 줄, 4초. 오류는 `danger-700` 면 | — |
| 5.13 | `Header` | 높이 64px, 하단 1px ink-900. 1차 메뉴 **4개**(§6). 로그인 = 2차 버튼. 로그인 후: 알림 종(아이콘 버튼 44px, aria-label), 닉네임·크레딧 칩(mono, "크레딧 1,200" — ₩ 표기 금지), 관리자 링크. 760px 이하: 로그인 + 햄버거(44px) | 11개 메뉴 헤더 |
| 5.14 | `MobileTabBar` | 760px 이하 고정 하단, 높이 56px + safe-area, 상단 1px ink-900, 탭 4개(§6) 아이콘+글자 11px, 활성 = ink-900 / 비활성 = ink-600. 키보드 열림 시 숨김 | 없음(신규) |
| 5.15 | `Footer` | 상단 1px ink-900, 흰 바탕, 정책 링크 5개 → `dl` 사업자 정보 7항목(상호·대표자·사업자등록번호·통신판매업 신고·주소·전화·이메일, mono 숫자) → 판매·환불 주체 한 줄 → 크레딧 규칙 한 줄. 12.5px 이상. **결제 페이지 포함 모든 페이지에 렌더** | 푸터 |
| 5.16 | `FloatingActions` | 떠 있는 버튼 3개(공지·문의 메일·카카오 오픈채팅)를 **하나의 세로 스택**으로, 직각 44px, 먹색 면. 모바일에서는 탭 바 위 `bottom: 72px` | 오른쪽 아래 버튼 3개 |

## 6. 헤더 메뉴 재구성 (확정안으로 구현)

| 1차 메뉴 | 포함되는 기존 메뉴 | 라우트 |
|---|---|---|
| 테스트하기 | 매칭 가능, 급구(목록 상단 급구 칸), 내 테스트 | `/browse`, `/my-tests` |
| 테스터 모으기 | 내 앱, 급구 신청, 맞테스트 | `/apps`, `/paid-testers`, `/my-reviews` |
| 커뮤니티 | 게시판, 가이드, 랭킹 | `/board`, `/guide`, `/stats` |
| 내 공간 | 보상, 크레딧, 프로필, 알림 | `/rewards`, `/credits`, `/profile`, `/notifications` |

데스크톱: 1차 메뉴 hover/focus 시 2차 메뉴를 **드롭다운이 아닌 헤더 아래 한 줄**(1px 괘선, 15px)로 펼친다. 모바일 탭 바: 테스트하기 / 테스터 모으기 / 커뮤니티 / 내 공간. 비로그인 상태에서 "내 공간" 탭은 로그인으로 보낸다.

## 7. 작업 순서와 각 단계의 중간 확인

커밋 단위는 아래 번호 하나당 1 PR(또는 1 커밋)이다. **각 단계 끝에 375px·1280px 스크린샷을 `03-output/design/screenshots/<단계>/` 에 저장하고 멈춘 뒤 운영자 확인을 받는다.** 확인 없이는 다음 단계로 가지 않는다.

1. **토큰·전역 스타일·글꼴** — `globals.css @theme` 교체, 대응표대로 기존 토큰 참조를 치환. 이 단계는 레이아웃을 바꾸지 않는다(색·반경·그림자·글꼴만). → 사이트 전체가 "흑백 + 직각"이 되면 통과.
2. **공통 컴포넌트** — §5 전부. Storybook 이 없으면 `/design-preview`(개발 환경 전용, `NODE_ENV==='production'` 에서 404) 페이지에 상태별로 나열.
3. **헤더·모바일 탭 바·푸터·떠 있는 버튼** — §5.13~5.16 + §6.
4. **홈 `/`** — `reference/home-c.html` 을 **그대로** 옮긴다. 숫자는 상수로, 문구는 원문 유지. 비로그인/로그인 두 상태.
5. **급구 신청 `/paid-testers`** — 영수증 컴포넌트가 중심. 로그인 없이 상품 설명·가격·진행 방식·환불 기준 표·돈의 쓰임 막대·판매 주체 문장·약관 링크가 **스크롤 2번 안에** 전부 보이게. 결제 오픈 대기 배지 + 결제 버튼 자리 안내(`PaymentPendingBadge`). → **4·5 두 장을 먼저 보여 주고 확인받은 뒤** 6으로.
6. **결제 `/paid-testers/checkout`, 결제 완료 `/success`** — 인원 선택(1~30, 기본 14) 스테퍼 48px + 영수증 실시간 합계 + `ConsentList` + 1차 버튼. 완료 화면은 영수증 재사용 + "충원 기간 결제 후 7일 · 급구 표시 14일" 안내(info).
7. **보상 `/rewards`, 크레딧 `/credits`** — 크레딧 규칙 4줄은 반전 섹션 또는 legal 상자로 **항상 노출**. 크레딧 수치는 mono, 단위는 "크레딧", ₩·원 금지. 교환은 5,000부터 5,000 단위, 1회 최대 50,000 — 상수로.
8. **정책 5종** — 본문 폭 720px, 세리프 h1, 목차 괘선 리스트, 본문 16px/1.8. 문구는 손대지 않는다.
9. **P1**: `/browse`(AppCard, 상단 급구 칸은 `accent` 1.5px 테두리 영역), `/my-tests`(체크인은 첫 화면에서 **탭 2번**: [오늘 체크인] → 스크린샷 선택 → 자동 제출, 진행 달력은 mono 14칸), `/apps/*`, `/my-reviews`, `/console/orders/[id]`(영수증 + Table), `/notifications`, `/auth/*`, `/profile`.
10. **P2·P3**: 같은 컴포넌트로 교체만. 관리자는 토큰만 적용, 레이아웃 유지.
11. **검수 산출물**: §9 표 체크 결과 + 대비 수치 표(§8) + 변경된 문구가 있다면 "문구 제안" 표(원문/제안/이유)를 `03-output/design/C-implementation-report.md` 로.

## 8. 접근성 — 구현 전 확인된 대비 수치 (WCAG 2.2 AA)

| 조합 | 대비 | 용도 | 판정 |
|---|---|---|---|
| `#111111` on `#FFFFFF` | 18.9:1 | 제목·본문 | 통과 |
| `#444444` on `#FFFFFF` | 9.7:1 | 본문 보조 | 통과 |
| `#555555` on `#FFFFFF` | 7.5:1 | 캡션 | 통과 |
| `#FFFFFF` on `#C8371F` | 5.2:1 | 급구 배지 | 통과 |
| `#C8371F` on `#FFFFFF` | 5.2:1 | 강조 글자·환불 표시 | 통과 |
| `#FFFFFF` on `#1F7A4D` | 5.3:1 | 완료 배지 | 통과 |
| `#BBBBBB` on `#111111` | 9.8:1 | 반전 섹션 보조 글자 | 통과 |
| `#888888` on `#FFFFFF` | 3.6:1 | — | **불합격 → 글자색으로 쓰지 말 것** |

그 외: 터치 영역 44×44 이상(배지는 터치 대상이 아니므로 예외), 포커스 링 3px accent, 상태 배지는 글자 포함, `prefers-reduced-motion` 존중, 이미지 없는 디자인이므로 LCP 는 글꼴 로드에 좌우됨 → `display=swap` 유지.

## 9. 완료 기준 (운영자가 이 표로 검수)

- [ ] 375px 홈 첫 화면에서 서비스·개발자 이득·테스터 이득이 10초 안에 읽힌다 (히어로 제목 + 세 숫자 타일)
- [ ] 급구 신청에서 가격·인원·환불·돈의 쓰임·판매 주체가 스크롤 2번 안에 보인다 (영수증 컴포넌트)
- [ ] 모든 P0 페이지 푸터에 사업자 정보 7항목 + 판매·환불 주체 문장
- [ ] 크레딧에 ₩·원·동전·지폐 없음, "보상" 언어만
- [ ] 안내 상자 3종이 색·아이콘·형태로 구분되고 왼쪽 색 테두리 없음
- [ ] `/my-tests` 체크인이 첫 화면에서 탭 2번
- [ ] 헤더 1차 메뉴 4개, 모바일 탭 바 동작, 11개 메뉴 전부 도달 가능
- [ ] §8 대비 표 통과, 포커스 링 보임, 375px 가로 스크롤 없음
- [ ] `@theme` 에 §3 토큰이 그대로 있고 기존 토큰 참조가 0건 (`grep -r "trust-\|spark\|mint\|amber\|sky-" src/` 결과 없음)
- [ ] 이모지 0건 (`grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/` 결과 없음)
- [ ] 문구 변경은 전부 "문구 제안" 표로 분리, 결제·환불·약관·크레딧 문구는 원문 그대로

## 10. 진행 방식·금지 사항

1. 시작 전 질문은 최대 5개. 답이 없어도 진행할 수 있으면 가정을 적고 진행한다.
2. 브랜치 `design/c-receipt` 에서 작업. 단계별 PR. `main`·`결제심사` 브랜치에 직접 푸시하지 않는다.
3. 로컬 개발 서버(`05-harness/scripts/tm-dev local` → `pnpm -C 03-output/app dev`)로 확인. 운영 사이트에 아무것도 제출하지 않고 결제 버튼을 누르지 않는다.
4. 배포·마이그레이션·결제·메일 발송·외부 서비스 설정 변경은 하지 않는다.
5. 새 의존성은 Lucide 아이콘 하나만. 애니메이션 라이브러리·대형 이미지 금지.
6. 원 브리프 §5.3 의 금지 표현(구매·충전·환전·현금·환급, 리뷰·별점과 보상 연결, 광고·노출 보장, 중개·수수료, "돈을 번다")은 코드·주석·플레이스홀더에도 쓰지 않는다.
