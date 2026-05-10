# 2026-05-05 — 관리자 import null 필드 정규화

## 증상

외부 수집 데이터를 `/admin/apps/import` 로 붙여넣을 때 `short_description=null` row 가 검증에서 실패했다.

```text
검증 실패 (row 1, short_description): Expected string, received null
```

## 수정

관리자 import 전용 validator 에서 수집 데이터의 빈 값을 정규화한다.

| 필드 | 입력 | 처리 |
|---|---|---|
| `short_description` | `null`, 생략, 빈 문자열 | `앱 테스트 참여자를 모집합니다.` |
| `nickname` | `null`, 빈 문자열 | 생략 처리 후 이메일 prefix 사용 |
| `required_testers` | `null`, 빈 문자열 | 기본값 12 |

일반 앱 등록/수정 폼은 기존처럼 사용자가 직접 앱 설명을 입력해야 한다.

