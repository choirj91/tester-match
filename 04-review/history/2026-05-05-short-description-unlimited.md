# 2026-05-05 — short_description 길이 제한 제거

## 증상

관리자 import 에서 앱 설명이 140자를 넘으면 실패했다.

```text
검증 실패 (row 62, short_description): String must contain at most 140 character(s)
```

## 수정

`short_description` 의 140자 제한을 제거했다.

| 파일 | 변경 |
|---|---|
| `lib/validators/admin-app-import.ts` | import validator `.max(140)` 제거 |
| `lib/validators/app.ts` | 앱 등록/수정 validator `.max(140)` 제거 |
| `apps/new/app-form.tsx` | textarea `maxLength` 제거 |
| `apps/[id]/edit/edit-app-form.tsx` | textarea `maxLength` 제거 |
| `supabase/migrations/20260505000004_short_description_unlimited.sql` | DB check constraint 제거 |

`NOT NULL` 은 유지한다. 관리자 import 에서는 `null`/빈 문자열을 기존 기본 문구로 정규화한다.

