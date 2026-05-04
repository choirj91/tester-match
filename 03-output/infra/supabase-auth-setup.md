# Supabase Auth — Google OAuth 설정 가이드

> [ADR-0004](../../01-source/decisions/ADR-0004-auth-strategy.md): Supabase Auth 채택. Google OAuth 자격증명은 앱 `.env`가 아닌 **Supabase Dashboard에서 관리**.

---

## 1. Google Cloud Console — OAuth Client 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속 → 프로젝트 선택(또는 신규 생성).
2. **APIs & Services** → **OAuth consent screen** 먼저 셋업
   - User Type: External
   - App name: `Tester Match`
   - User support email / Developer contact email: 본인 이메일
   - Scopes: `email`, `profile`, `openid` (기본)
   - Test users: 개발 단계에서는 본인 이메일 추가 (아직 verification 미신청 상태에서 다른 사용자 차단됨)
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Tester Match (dev)` 또는 `Tester Match (prod)`
   - **Authorized JavaScript origins**: (생략 가능)
   - **Authorized redirect URIs**: 정확히 다음 값 입력 ⚠️

```
https://eebilophixfdzclmcpoo.supabase.co/auth/v1/callback
```

> 이 URI는 Supabase의 OAuth 중계 엔드포인트로, 우리 앱이 아닌 **Supabase 프로젝트 도메인**입니다. 헷갈리지 말 것.

4. 생성 후 화면에 표시되는 **Client ID**와 **Client secret** 복사.

---

## 2. Supabase Dashboard — Google Provider 활성화

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트(`eebilophixfdzclmcpoo`) 선택
2. **Authentication** → **Providers** → **Google** 행 펼치기
3. **Enable Sign in with Google** 토글 ON
4. **Client ID (for OAuth)**: 위에서 복사한 Client ID 붙여넣기
5. **Client Secret (for OAuth)**: Client secret 붙여넣기
6. **Save**

---

## 3. Supabase Dashboard — Redirect URLs 등록

1. **Authentication** → **URL Configuration**
2. **Site URL**: 개발 단계에서는 `http://localhost:3000`. 운영 전환 시 `https://testermatch.com`으로 갱신.
3. **Redirect URLs** (Allowed) — 다음 값들 추가:

```
http://localhost:3000/auth/callback
https://testermatch.com/auth/callback
https://*.testermatch-pages.dev/auth/callback
```

> Cloudflare Pages preview 배포는 와일드카드로 한 번에 허용.

4. **Save**

---

## 4. 로컬 검증

```bash
cd 03-output/app
pnpm dev
```

1. http://localhost:3000/auth/login 접속
2. **Google로 계속하기** 클릭 → Google 동의 화면
3. 권한 허용 → `https://eebilophixfdzclmcpoo.supabase.co/auth/v1/callback` 경유 → `http://localhost:3000/auth/callback` 으로 복귀 → `/` 리다이렉트
4. Supabase Dashboard → **Authentication** → **Users** 에 본인 이메일이 있어야 함
5. **Table Editor** → `public.users` 에 자동 생성된 row 확인 (`auth_user_id`, `email`, `nickname` 채워짐)

### 문제 해결

| 증상 | 원인 | 조치 |
|---|---|---|
| `redirect_uri_mismatch` | Google Cloud Console에 Supabase 콜백 URI 미등록 | 1번 단계 redirect URI 정확히 일치하는지 확인 |
| Supabase로 돌아왔으나 `/` 대신 `/auth/login?error=exchange_failed` | Site URL/Redirect URLs 누락 | 3번 단계 확인 |
| `public.users`에 row 없음 | 트리거 실패 | Dashboard → SQL Editor → `select * from auth.users;` vs `select * from public.users;` 비교. 트리거 함수 권한(SECURITY DEFINER) 확인. |
| `Access blocked: This app's request is invalid` | OAuth consent screen 미배포 | 1번 2단계의 OAuth consent screen에서 Test user 등록 또는 Publish |

---

## 5. 로그아웃 흐름

`/auth/signout`에 POST 요청 → 세션 쿠키 제거 → `/`로 리다이렉트.

향후 헤더 컴포넌트 추가 시 다음 폼 사용:

```tsx
<form action="/auth/signout" method="post">
  <button type="submit">로그아웃</button>
</form>
```

---

## 6. 운영 전환 체크리스트

- [ ] Google Cloud Console OAuth consent screen → **Production** 으로 publish (Verification 신청 필요할 수 있음, scope 가 email/profile/openid 만이면 자동 승인)
- [ ] Site URL 을 `https://testermatch.com` 으로 변경
- [ ] Cloudflare Pages 환경 변수에 `NEXT_PUBLIC_APP_URL=https://testermatch.com` 설정
- [ ] OAuth Client → **Authorized redirect URIs** 에 운영 도메인 추가
- [ ] 회원 탈퇴(F-AUTH-04) 흐름이 `auth.users` 삭제 vs `public.users.deleted_at` soft delete 분기 처리하는지 확인
