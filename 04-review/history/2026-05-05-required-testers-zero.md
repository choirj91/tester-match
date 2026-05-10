# 2026-05-05 — required_testers 0 허용

## 배경

관리자 앱 import 에서 `required_testers=0` 인 데이터가 검증 단계에서 실패했다.

```text
검증 실패 (row 1, required_testers): Number must be greater than or equal to 1
```

## 수정

`required_testers` 허용 범위를 0~100 으로 통일했다.

| 파일 | 변경 |
|---|---|
| `lib/validators/admin-app-import.ts` | import validator 0~100 허용 |
| `lib/validators/app.ts` | 앱 등록/수정 validator 0~100 허용 |
| `apps/new/app-form.tsx` | number input min/max 0~100 |
| `apps/[id]/edit/edit-app-form.tsx` | number input min/max 0~100 |
| `admin/apps/import/page.tsx` | 안내 문구 0~100 으로 수정 |
| `supabase/migrations/20260505000003_required_testers_zero.sql` | DB check constraint 0~100 으로 변경 |

## 동작

- `0`: 저장 가능. 매칭 API 는 기존처럼 `required_testers <= 0` 이면 정원 마감으로 응답.
- `1~100`: 저장 가능.
- `101 이상`: 검증 실패.

