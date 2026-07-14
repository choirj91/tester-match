# 사업자 등록 후 자동화 기능 — 브랜치 `feat/post-registration-automation`

작성: 2026-07-14

## 목적

Knock Knock Company 사업자 등록증 확보 이후 실제 서비스 배포 전에 담는 최대치의 자동화·편의 기능. 브랜치에서 전부 개발 후 스테이징 검증을 거쳐 main 병합.

---

## 이 브랜치의 변경 요약

### 1) Play Store URL 자동 파싱 (F-APP-03)

**추가 파일:**
- `app/src/app/api/apps/parse-play-store/route.ts`
- `app/src/app/apps/new/app-form.tsx` (수정 — 자동 채움 섹션)

**동작:**
- 개발자가 Play Store URL 을 붙여넣기 → OG 태그 파싱 → 앱 이름·설명·아이콘·초대 링크 자동 세팅
- 기존 입력값 있으면 덮어쓰지 않음 (안전)
- 실패 시 사용자에게 명시적 문구 표시

**의존성:** 없음. 즉시 동작.

**주의사항:**
- Play Store 페이지가 렌더 방식 바꾸면 `og:title` 태그 사라질 수 있음 → 폴백 `<title>` 태그도 파싱
- Cloudflare Pages Edge Runtime 이 fetch 로 Play Store 를 크롤링. rate limit 는 IP 기반이므로 대량 요청 시 재검토 필요

### 2) 온보딩 진행률 (F-UX-01)

**추가 파일:**
- `app/src/components/onboarding-progress.tsx`
- `app/src/app/page.tsx` (수정 — 로그인 유저에게 노출)

**동작:**
- 3단계: 회원가입 → 첫 앱 등록 → 첫 매칭 참여
- 모두 완료 시 자동 숨김
- 로그인한 유저의 홈페이지 상단에 노출

**DB 쿼리:** 유저별 `apps` count + `matches` count (SELECT count HEAD). 로우 컨텐션 낮음.

### 3) 개발자 KPI 대시보드 (F-UX-02)

**추가 파일:**
- `app/src/app/apps/[id]/kpi-section.tsx`
- `app/src/app/apps/[id]/page.tsx` (수정 — SELECT 에 `day_count` 추가, `<KpiSection>` 렌더)

**동작:**
- 총 매칭 / 완주율 / 이탈률 / 평균 체크인 진행률 (KpiCard 4개)
- 최근 7일 신규 매칭 막대 차트 (KST 기준)
- 앱 소유자만 접근 (기존 owner_user_id 필터 유지)

**의존성:** 없음. 즉시 동작.

### 4) Google Workspace 그룹 자동 가입 (F-AUTH-01)

**추가 파일:**
- `app/src/lib/google-groups.ts` — Edge runtime 호환 서비스 계정 JWT 서명 + Admin SDK Directory API 클라이언트
- `supabase/migrations/20260714000001_users_groups_joined_at.sql` — `users.groups_joined_at timestamptz` 컬럼
- `app/src/lib/auth.ts` (수정 — 첫 로그인 시 1회 그룹 자동 가입)
- `app/src/app/apps/[id]/page.tsx` (수정 — 그룹 이메일 안내 카드)

**동작:**
- 환경변수 3종 모두 설정된 경우에만 활성. 미설정 시 조용히 no-op → 개발/스테이징 문제없음
- `getCurrentUser()` 에서 `groups_joined_at IS NULL` 인 유저만 백그라운드 fire-and-forget 로 그룹 추가
- 이미 멤버(409) 는 정상 처리
- `/apps/[id]` 페이지에 그룹 이메일 안내 카드 (개발자에게 Play Console 에 등록할 이메일 노출)

**환경변수 (Cloudflare Pages 에 시크릿으로 등록 필요):**

| 이름 | 값 | 비고 |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON 전체 문자열 | GCP → IAM → 서비스 계정 → 키 → JSON 다운로드 |
| `GOOGLE_ADMIN_EMAIL` | Workspace super admin 이메일 | Domain-Wide Delegation impersonation 용 |
| `TESTER_GROUP_EMAIL` | 예: `testers@knockknockcompany.com` | Workspace Admin 콘솔에서 생성한 그룹 이메일 |
| `TESTER_GROUP_URL` (선택) | 그룹 웹 뷰 URL | 미지정 시 이메일 기반 자동 추정 |

**Google Cloud / Workspace 설정 절차 (사용자 작업):**

1. **Cloud Identity Free 가입**: workspace.google.com/products/cloud-identity/free/
   - 소유 도메인 필요 (예: `knockknockcompany.com`)
   - DNS TXT 레코드로 도메인 인증
2. **그룹 생성**: Workspace Admin 콘솔 → 디렉터리 → 그룹 → 생성
   - 이메일: `testers@yourdomain.com`
   - 액세스 설정: 조직 외부 사용자 가입 허용
3. **Google Cloud 프로젝트**:
   - console.cloud.google.com → 프로젝트 만들기
   - Admin SDK API 활성화
4. **서비스 계정 생성**:
   - IAM → 서비스 계정 → 만들기
   - JSON 키 다운로드
   - 서비스 계정 세부 정보 → **도메인 전체 위임 활성화** 체크
   - 표시되는 **클라이언트 ID** 기록
5. **Workspace 관리 콘솔에서 위임 승인**:
   - admin.google.com → 보안 → 액세스 및 데이터 컨트롤 → API 컨트롤 → 도메인 전체 위임
   - 클라이언트 ID 추가
   - 스코프: `https://www.googleapis.com/auth/admin.directory.group.member`
6. **Cloudflare Pages 환경변수**:
   - dash.cloudflare.com → Pages → tester-match → Settings → Environment variables
   - Production 환경에 위 4개 시크릿 등록

**절차 완료 없이도 브랜치는 동작.** 환경변수 미설정 시 안내 카드 미노출 + 자동 가입 no-op.

---

## 배포 전 체크리스트

### 코드 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] `npx @cloudflare/next-on-pages` 빌드 성공
- [ ] `npx vitest run` (기존 89 test) 통과
- [ ] 브랜치 로컬에서 `npm run dev` 로 홈/앱 등록/앱 관리 페이지 동작 확인

### 스테이징 배포 (별도 프로젝트 or preview branch)
- [ ] `wrangler pages deploy --branch feat/post-registration-automation` 로 미리보기 URL 생성
- [ ] Play Store URL 파싱 실제 앱 3~5개로 테스트
- [ ] 온보딩 진행률 신규 유저 시나리오로 확인
- [ ] KPI 차트 데이터 정확도 검증 (SQL 결과 대조)

### Google Workspace 설정 사전 완료 (사용자)
- [ ] Cloud Identity Free 가입 및 도메인 인증
- [ ] 그룹 생성 및 액세스 설정
- [ ] Google Cloud 프로젝트 + 서비스 계정 + JSON 키 발급
- [ ] 도메인 전체 위임 활성화 + Workspace Admin 콘솔에서 승인
- [ ] Cloudflare Pages 환경변수 4종 등록 (Production)

### 프로덕션 배포
- [ ] Supabase 마이그레이션 push: `20260714000001_users_groups_joined_at.sql`
- [ ] main 병합 → `wrangler pages deploy` 로 프로덕션 반영
- [ ] Google 그룹 안내 카드 노출 확인 (`/apps/[id]`)
- [ ] 신규 회원가입 시 그룹 자동 추가 확인 (Workspace Admin 콘솔 → 그룹 멤버 목록)
- [ ] 기존 유저는 로그인 시 순차 자동 가입 (다음 세션부터 groups_joined_at 세팅)

### 롤백 계획

**Google 그룹 자동 가입 문제 발생 시:**
1. Cloudflare Pages 환경변수 `GOOGLE_SERVICE_ACCOUNT_JSON` 삭제 → 즉시 no-op 전환
2. 자동 가입 이슈 있는 사용자는 `UPDATE users SET groups_joined_at = NULL WHERE ...` 후 재시도

**Play Store 파싱 실패 시:**
- 사용자에게 수동 입력 폴백 안내. 컴포넌트가 이미 fail-open 이므로 서비스 자체는 정상.

**KPI 대시보드 데이터 이슈:**
- 컴포넌트 렌더 안 되면 페이지 500 → matches 쿼리 실패 시 `matches ?? []` 로 방어됨. 문제 없음.

---

## 추후 확장 (이 브랜치 범위 아님)

- Web Push 알림 (VAPID + Service Worker)
- Play Console API 개발자별 연동 (androidpublisher + Reporting API)
- Google 그룹 멤버 목록으로 활성 테스터 수 실시간 표시 (관리자 통계)
- 이탈률 개선을 위한 자동 리마인더 강화 (D-1 이메일 + 카톡 알림)
- 도메인 전환 (`knockknockcompany.com` 커스텀 도메인)
