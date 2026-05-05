# 2026-05-05 — 관리자 앱 일괄 등록 + Placeholder 사용자 자동 매칭

> 사용자가 외부에서 수집한 (이메일 + 앱) 데이터를 한 번에 등록하기 위한 도구. 미가입 이메일은 placeholder 사용자로 만들고, 추후 같은 이메일로 Google 로그인 시 자동으로 본인 앱으로 매칭.

---

## 핵심 메커니즘

이미 [Migration #2 (ADR-0004)](../../01-source/decisions/ADR-0004-auth-strategy.md) 의 `handle_new_auth_user` 트리거가 placeholder → 실 사용자 자동 매칭을 지원:

```sql
on conflict (email) do update
  set
    auth_user_id = case
      when public.users.auth_user_id is null then excluded.auth_user_id
      else public.users.auth_user_id  -- 이미 다른 OAuth 와 연결된 경우 보존(탈취 차단)
    end,
    google_id = coalesce(public.users.google_id, excluded.google_id),
    nickname  = coalesce(public.users.nickname, excluded.nickname);
```

따라서 placeholder 만 잘 만들어두면 자동 매칭. 이번 PR은 **placeholder + 앱을 한 번에 만드는 관리자 UI** 추가만 담당.

---

## 신규

| 파일 | 역할 |
|---|---|
| lib/admin.ts | `requireAdminUser()` (페이지 가드), `getAdminUser()` (API 가드) |
| lib/validators/admin-app-import.ts | `AppImportRowSchema` + `AppImportBatchSchema` (1~200건) |
| lib/validators/admin-app-import.test.ts | 9 tests |
| api/admin/apps/import/route.ts | POST: 행별 user upsert + apps insert. 같은 batch 안 동일 이메일 캐싱. |
| admin/page.tsx | 관리자 인덱스 (현재 1개 타일) |
| admin/apps/import/page.tsx | 등록 UI 페이지 (입력 형식 안내 포함) |
| admin/apps/import/import-form.tsx | client. JSON 붙여넣기 → 결과 요약 + 오류 행 노출 |
| components/site-header.tsx | admin 전용 "관리자" 칩 (spark-50, role==='admin' 일 때만) |

---

## 입력 포맷

```json
[
  {
    "email": "alice@example.com",
    "nickname": "닉네임 (선택)",
    "app_name": "앱 이름",
    "store_invite_url": "https://play.google.com/apps/test/...",
    "web_invite_url": "https://play.google.com/apps/testing/...",
    "required_testers": 12,
    "short_description": "한 줄 설명",
    "status": "matching"
  }
]
```

기본값:
- `required_testers`: 12 (1~12 clamp)
- `status`: `matching` (matching/reviewing/launched/paused 중)
- `nickname`: 생략 시 이메일 prefix 사용

---

## 동작

1. 관리자 권한 검증 (role='admin' 필수, 아니면 403)
2. JSON 검증 (`AppImportBatchSchema`): 1~200건, URL 정규식, 필드 길이
3. 행별 처리:
   - 캐시 → DB 조회 → 없으면 placeholder 사용자 INSERT (auth_user_id NULL)
   - 같은 batch 안 동일 이메일은 캐시로 1회 lookup
   - apps INSERT (admin client → service_role 우회)
4. 응답: `{ imported, skipped, total, placeholders_created, errors[] }`

### 자동 매칭 흐름

```
[admin import] → public.users (auth_user_id=NULL, email=X) + apps row
                                    ↓
            (시간 경과)
                                    ↓
[해당 사용자 Google 로그인] → auth.users INSERT
                                    ↓
            handle_new_auth_user 트리거 발동
                                    ↓
       on conflict(email)=X 매칭 → auth_user_id 업데이트
                                    ↓
[/apps 페이지 진입] → owner_user_id 매칭 → 본인 앱 노출
```

---

## 보안 가드

| 계층 | 방어 |
|---|---|
| 페이지 (`/admin/*`) | `requireAdminUser()` — 비인증 → /auth/login, 일반 사용자 → / |
| API (`/api/admin/*`) | `getAdminUser()` — null 이면 403 |
| DB | RLS 정책은 그대로. admin client(service_role) 가 우회. |
| 사용자 권한 상승 차단 | `users_protect_admin_fields` 트리거가 일반 사용자의 role 변경 차단 (기존). admin role 부여는 SQL Editor 또는 admin 직접만. |

---

## 사용자 액션 (관리자 자기 권한 부여)

처음 한 번, Supabase Dashboard SQL Editor 에서:

```sql
update public.users
   set role = 'admin'
 where email = '본인_이메일@example.com';
```

이후 `/admin` 으로 접근 가능. 헤더 "관리자" 칩이 노출됨.

---

## 검증

```bash
pnpm typecheck   # ✓
pnpm lint        # ✓
pnpm test        # ✓ 72/72 (admin-app-import 9 tests 추가)
```

### 시나리오

1. 본인 계정에 admin 권한 부여 → 헤더에 "관리자" 칩
2. /admin/apps/import → 예시 JSON 채우기 → 한 번 더 수정 → 일괄 등록
3. 응답 확인 — imported=N, placeholders_created=M
4. /browse 진입 → 등록한 앱 카드 보임 (등록자 닉네임은 이메일 prefix)
5. (별도 시뮬: placeholder 이메일로 새 Google 계정 생성) → 로그인 → /apps 진입 → 등록한 앱이 본인 앱으로 보임

### Edge cases

- [x] 같은 batch 동일 이메일 여러 줄 → 1번만 lookup, 같은 user_id 사용
- [x] 이미 가입된 이메일 → 기존 user_id 사용, 앱만 추가됨 (admin 책임)
- [x] 잘못된 URL/이메일 → row 스킵, errors[] 누적
- [x] role='admin' 아닌 사용자 → 페이지 / 리다이렉트, API 403

---

## 미완료 / 후속

- [ ] CSV/TSV 업로드 지원 (현재 JSON 만)
- [ ] 등록 전 dry-run (검증만, 실제 INSERT 안 함)
- [ ] 중복 앱 등록 차단 옵션 (현재는 같은 사용자 동일 이름 앱이 여러 개 가능)
- [ ] placeholder 사용자에게 "당신 앱이 등록됐습니다, Google 로그인하면 본인 앱으로 확인 가능" 안내 메일 자동 발송 옵션
- [ ] 관리자 모니터링 페이지 (앱 / 사용자 / 매칭 / 신고) — F-ADMIN-02/03/04
