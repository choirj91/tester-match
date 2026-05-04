# 2026-05-04 — F-APP-01 앱 등록

> 첫 도메인 기능. 인증 + RLS + 도메인 모델 end-to-end 검증.

---

## 세션 요약

사용자가 현재 운영 중인 외부 폼(닉네임/앱 이름/이메일/안드로이드 링크/웹 참여 링크/현재 남은 테스터 수/앱 설명)을 그대로 흡수하도록 ERD 일부 조정 + 등록 플로우 구현.

---

## 신규 / 수정

| 카테고리 | 파일 | 비고 |
|---|---|---|
| Migration | 03-output/supabase/migrations/20260504000004_apps_form_fields.sql | `web_invite_url` 추가, `category` NOT NULL 완화 + default 'general', 컬럼 코멘트 정리 |
| Validator | 03-output/app/src/lib/validators/app.ts | zod `AppCreateSchema` (URL + play.google.com 정규식, required_testers 1-12) |
| API | 03-output/app/src/app/api/apps/route.ts | POST 핸들러: 인증 확인 → 닉네임 변경 시 users UPDATE → apps INSERT (status='matching') |
| Page | 03-output/app/src/app/apps/page.tsx | 본인 앱 목록 + 상태 배지 + 빈 상태 CTA |
| Page | 03-output/app/src/app/apps/new/page.tsx | 등록 페이지 (서버 컴포넌트, 사용자 정보 pre-fill) |
| Component | 03-output/app/src/app/apps/new/app-form.tsx | client form, fetch POST /api/apps |
| Component | 03-output/app/src/components/site-header.tsx | 인증 페이지용 공통 헤더 (로고/내 앱/닉네임/로그아웃) |
| Modify | 03-output/app/src/app/page.tsx | 헤더 CTA 인증 분기: 로그인 시 "내 앱 →", 비로그인 시 기존 "사전 등록" 유지 |

---

## 폼 필드 ↔ DB 매핑

| 폼 라벨 | DB | 처리 |
|---|---|---|
| 닉네임 | `users.nickname` | pre-fill, 변경 시 함께 UPDATE. 보호 트리거가 role/trust_score/status 동시 조작 차단. |
| 이메일 주소 | `users.email` (auth) | read-only 표시 (변경 불가) |
| 앱 이름 | `apps.name` | 1-100 chars |
| 안드로이드 링크 | `apps.store_invite_url` | URL + `play.google.com` 도메인 검증 |
| 웹 참여 링크 | `apps.web_invite_url` (신규) | 동일 검증 |
| 현재 남은 테스터 수 | `apps.required_testers` | int 1-12, default 12 |
| 앱 설명 | `apps.short_description` | trim 후 1-140 chars |

폼에 없는 `apps.category`는 default 'general'로 저장. F-APP-05(카테고리 마스터 도입) 시점에 정교화.

---

## 결정 메모

| 항목 | 결정 | 이유 |
|---|---|---|
| 등록 직후 status | `matching` (draft 생략) | MVP UX 단순화. 사용자가 즉시 매칭 큐 진입 기대. 실수 시 `paused` 전환 가능. |
| HEAD 검증 (F-APP-02) | 본 PR 미포함 | edge runtime 에서 외부 HEAD 호출은 타임아웃·차단 위험. cron + `store_invite_url_validated_at` 갱신으로 분리. |
| 닉네임 자동 동기화 | 폼 제출 시 UPDATE | 사용자가 앱 등록 화면에서 닉네임을 수정하면 프로필 전반에 반영. 별도 닉네임 편집 화면 생략. |
| ERD §2.3 `category NOT NULL` | 제약 완화 | 폼에서 입력 받지 않음. ADR 미작성(컬럼 nullability 변경은 ADR 임계점 아님). |

---

## 검증

```bash
cd /Users/nakjun/app/choirj91-git/앱출시-테스터모집/tester-match/03-output
supabase db push   # 마이그레이션 #4 적용

cd app && pnpm dev
```

### Happy path

1. http://localhost:3000 → 로그인 상태이면 헤더 CTA가 "내 앱 →"로 표시
2. `/apps` → 빈 상태 → "+ 앱 등록"
3. 폼 작성 → 제출 → `/apps` 복귀, 등록한 카드 1장
4. Supabase Dashboard → Table editor → `apps` row 확인 (`owner_user_id`, `web_invite_url`, `required_testers`, `status='matching'`)

### Edge cases

- [ ] 비로그인 상태에서 `/apps` 직접 접근 → `/auth/login?next=/apps` 리다이렉트
- [ ] 다른 사용자의 앱 row 접근 차단 (RLS) — 시드 더미가 만든 앱이 본인 목록에 안 보여야 함
- [ ] 닉네임 변경 → 폼 제출 → `users.nickname` 갱신 확인
- [ ] 잘못된 URL ("https://example.com") 입력 → "play.google.com 도메인이 포함된 링크여야 합니다." 메시지

---

## 미완료 / 후속

- [ ] F-APP-02: 초대 링크 HEAD 검증 (cron 분리)
- [ ] F-APP-03: 앱 상태 전환 UX (일시정지/완료)
- [ ] F-APP-04: 앱 정보 수정 / 삭제 (soft delete)
- [ ] F-APP-05: 카테고리 마스터 + 분류 UX
- [ ] 매칭중 앱 목록 (`/apps/browse` — 다른 개발자가 테스트 지원할 페이지)
- [ ] 앱 상세 페이지 (`/apps/[id]`)
