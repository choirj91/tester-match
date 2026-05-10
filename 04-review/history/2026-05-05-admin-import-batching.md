# 2026-05-05 — 관리자 앱 import 200건 초과 배치 처리

## 증상

`/admin/apps/import` 에서 JSON 배열이 200건을 초과하면 API 검증에서 실패했다.

```text
실패: 검증 실패 (): 한 번에 최대 200건까지 가능합니다.
```

## 수정

서버 API 의 200건 제한은 유지하고, 클라이언트 폼에서 전체 입력을 먼저 row 단위로 검증한 뒤 200건 단위로 나눠 순차 POST 하도록 변경했다.

| 파일 | 변경 |
|---|---|
| `admin/apps/import/import-form.tsx` | 200건 chunking, 진행 상태, 결과 합산 |
| `api/admin/apps/import/route.ts` | row 번호 1-base 반환, 실제 생성된 placeholder 수만 집계 |
| `admin/apps/import/page.tsx` | 안내 문구 수정 |
| `admin/apps/import/import-form.test.ts` | chunk/merge 단위 테스트 추가 |

## 동작 예시

401건 입력 시:

1. 1~200행 POST
2. 201~400행 POST
3. 401행 POST
4. `imported`, `skipped`, `total`, `placeholders_created`, `errors[]` 를 합산 표시

서버는 각 요청당 최대 200건만 처리하므로 Edge Function/DB 부하를 기존 제한 안에 둔다.

