# 2026-05-05 — Browse 페이지 개선

> 카드/리스트 뷰 토글, 정렬, 상태 표시, 등록 날짜 추가. 신뢰도 제거.

---

## 변경 내용

| 항목 | 이전 | 이후 |
|---|---|---|
| 신뢰도 표시 | 있음 (`신뢰 72`) | 제거 |
| 상태 표시 | 없음 | 각 카드에 상태 뱃지 (모집중 / 심사중 / 출시 완료) |
| 등록 날짜 | 없음 | `M월 D일 등록` 형태로 카드 하단에 표시 |
| 정렬 | is_boost DESC + 최신순 고정 | 선택형 정렬 (최신순 / 오래된순 / 테스터 많은 순 / 상태순) |
| 뷰 모드 | 2열 카드 고정 | 카드 보기 (3열) / 리스트 보기 토글 |

---

## 신규 파일

| 파일 | 역할 |
|---|---|
| `app/browse/browse-controls.tsx` | 정렬 select + 뷰 토글 버튼 (client component) |

---

## 수정 파일

| 파일 | 변경 |
|---|---|
| `app/browse/page.tsx` | 전면 개편. 서버 컴포넌트에서 searchParams 읽어 정렬/뷰 결정 |

---

## 동작 방식

- **정렬·뷰**: URL searchParams (`?sort=newest&view=card`) — 북마크 가능, SEO 친화
- **Boost**: 정렬과 무관하게 항상 최상단 고정
- **상태 필터**: `BROWSE_STATUSES` (matching / reviewing / launched) 전체 노출

### 정렬 옵션

| 키 | 기준 |
|---|---|
| `newest` (기본) | created_at DESC |
| `oldest` | created_at ASC |
| `testers` | required_testers DESC |
| `status` | APP_STATUS_ORDER (모집중 0 → 심사중 1 → 출시 2) |

### 뷰 모드

| 키 | UI |
|---|---|
| `card` (기본) | 3열 카드 그리드. 상태 뱃지, 설명 2줄, 테스터 수, 등록자, 등록일 |
| `list` | 1열 테이블 형태. 상태 \| 앱명 \| 설명 1줄 \| 테스터 수 \| 등록자 \| 날짜 |

---

## 검증

```
pnpm typecheck  ✓
pnpm test       ✓ 83/83
```
