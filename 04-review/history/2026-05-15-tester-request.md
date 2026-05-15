# 2026-05-15 — 테스터 요청 이메일 기능

> 앱 소유자가 Tester Match 회원들에게 직접 이메일로 테스트 참여를 요청하는 기능.

---

## 기능 요약

| 항목 | 내용 |
|---|---|
| 일일 한도 | 하루 30명 (24시간 롤링 윈도우) |
| 자동 선택 | 최근 가입 순, 남은 한도만큼 자동 체크 |
| 중복 방지 | 동일 앱×수신자에게 재발송 불가 (DB unique constraint) |
| 제외 대상 | 이미 매칭된 테스터, 이미 요청 보낸 사람, 본인 |
| 이메일 발송 | Resend (기존 인프라 재사용) |

---

## 신규 파일

| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260514000001_tester_request_sends.sql` | 발송 이력 테이블 |
| `app/api/apps/[id]/tester-request/route.ts` | GET 후보자 목록 · POST 이메일 발송 |
| `app/apps/[id]/request-testers/page.tsx` | 요청 페이지 (서버 컴포넌트) |
| `app/apps/[id]/request-testers/request-form.tsx` | 수신자 체크박스 + 이메일 편집 클라이언트 폼 |
| `lib/email-templates.ts` → `testerRequestEmail()` 추가 | 요청 이메일 HTML 템플릿 |

---

## 수정 파일

| 파일 | 변경 |
|---|---|
| `app/apps/[id]/page.tsx` | "테스터 요청" 버튼 추가 |

---

## UI 흐름

```
내 앱 상세(/apps/[id]) → [테스터 요청] 버튼
  └→ /apps/[id]/request-testers
       ├── 탭1: 수신자 선택
       │   ├── 일일 한도 표시 (남은 N/30명)
       │   ├── 전체 선택 체크박스
       │   └── 후보자 목록 (닉네임, 신뢰도, 자동 체크)
       └── 탭2: 이메일 내용 편집
           ├── 제목 입력 (수정 가능)
           ├── 본문 textarea (수정 가능)
           └── 실시간 미리보기
  → 발송 버튼 → 성공 화면 (발송 N명 완료)
```

---

## Resend 플랜 현황

| 플랜 | 조건 | 상태 |
|---|---|---|
| Free | 3,000건/월, 100건/일 | **현재 사용** |
| Pro ($20/월) | 50,000건/월, 1,000건/일 | DAU 100↑ 시 업그레이드 |

하루 100건/일 제한이 있으므로 약 3명의 개발자가 동시에 30명씩 발송하면 한도 도달.  
→ 사용자 급증 시 Pro 플랜 업그레이드 필요.

---

## 보안

- 앱 소유자만 해당 앱의 요청 페이지 접근 가능
- `tester_request_sends` unique constraint로 중복 발송 방지
- 수신자 이메일 주소는 서버에서만 조회 (클라이언트에 노출 안 됨)
- `auth_user_id IS NOT NULL` 조건으로 placeholder 사용자 제외

---

## 검증

```
pnpm typecheck  ✓
pnpm test       ✓ 89/89
pnpm pages:build ✓
supabase db push ✓
```
