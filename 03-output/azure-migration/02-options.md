# 02 — 선택지 비교와 권고

> **2026-10-04 결정으로 대체됨**: 창업자가 "전부 Azure, 최소 사양" 을 결정했다 (ADR-0015 Accepted) — 길 3(재작성)을 1→2→3단계 순서로 진행한다. 아래 "보류·조건부" 권고와 크레딧 소진 논거는 결정 전 분석 기록으로만 남긴다.

- 작성: 2026-10-04 · 기준 커밋 `8f942d3`
- 비용은 [04-cost.md](04-cost.md), 근거 파일은 [01-inventory-mapping.md](01-inventory-mapping.md)
- 작업량은 "1인 창업자 + AI 에이전트" 기준 작업일(하루 6시간 집중) [추정]

## 1. 비교한 길

| 길 | 내용 |
|---|---|
| **0. 보류** | 지금 구성 유지. 크레딧은 다른 용도(예: Azure OpenAI)로 |
| **1. 백엔드 유지, 나머지 이전** | Supabase 그대로. 호스팅·크론·관측·비밀 관리만 Azure |
| **2. Supabase 를 Azure 위에 직접 운영** | Supabase 셀프호스팅 스택(Postgres·GoTrue·PostgREST·Storage·Kong)을 VM/Container Apps 에 |
| **2′. PostgREST 만 자체 운영** (탐색 중 찾은 길) | DB 는 Azure PostgreSQL, supabase-js 가 부르는 REST 계층만 PostgREST 컨테이너로 흉내 → 약 320개 쿼리 무수정. 인증은 별도 교체 |
| **3. Azure 고유 서비스로 재작성** | Azure PostgreSQL + 쿼리 빌더 + Auth.js + Blob |

## 2. 비교표

| | 0. 보류 | 1. 호스팅만 | 2. Supabase 셀프호스팅 | 2′. PostgREST 자체 운영 | 3. 재작성 |
|---|---|---|---|---|---|
| 바뀌는 코드 | 0 | ~100 파일 (95% 기계적) | ~100 (1단계분) + 설정 | 1단계분 + 인증 ~12 + 스토리지 4 + 마이그레이션 ~7 | 1단계분 + 데이터 ~80 + 인증 ~12 + 스토리지 4 + 마이그레이션 ~7 + 테스트 |
| 작업량 | 0 | **5~8일** | 10~15일 + 상시 운영 | 12~18일 (PoC 성공 시) | **20~30일** |
| 운영 부담 (1인) | 현재 수준 | 낮음 (PaaS) | **높음** — Postgres·GoTrue·Kong 패치, 백업, 보안 | 중간 — PostgREST 컨테이너 1개 관리 | 낮음 (PaaS) |
| 핵심 위험 | 없음 | 응답 후 작업 유실, IP 헤더 | 관리형 Azure PostgreSQL 에선 불가 (superuser·`pg_net` 없음) → VM 자가 운영 강제 | PostgREST 역할·JWT 를 Azure PostgreSQL 에서 재현 가능한지 미검증 [추정] | 인증 재작성 보안 결함 — ADR-0013 에서 리뷰 3회 필요했던 영역 |
| 크레딧 기간 월 비용 | $0 | ~$13 (크레딧) | ~$40~70 (VM) [추정] | ~$40 | ~$37 |
| 크레딧 후 월 비용 | $0 (Supabase Free 기준) | ~$13 (+ Supabase $0/25) | ~$40~70 | ~$40 | ~$37 |
| 되돌리기 | — | **쉬움** (DNS 되돌림, Pages 배포 보존) | 어려움 | 중간 | 어려움 (쓰기 재개 후엔 역동기화 필요) |
| 다음 단계로 | 1로 | 2′ 또는 3 으로 자연 연결 | 막다른 길 | 3 으로 점진 이행 가능 | 종착 |

출처: Azure 확장 목록에 `pg_net`·`pgsodium`·`pg_graphql`·`supabase_vault` 없음 (https://learn.microsoft.com/en-us/azure/postgresql/extensions/concepts-extensions-versions, 확인일 2026-10-04) · 관리형 Postgres 는 Supabase 공식 지원 구성이 아님 (https://supabase.com/docs/guides/self-hosting, https://github.com/orgs/supabase/discussions/33843, 확인일 2026-10-04).

## 3. "Supabase 를 PostgreSQL 로 이관하면 좋을까?" 에 대한 답

**DB 자체는 이미 PostgreSQL 이고, Azure Database for PostgreSQL 로 옮기는 것은 쉽다.** 33 MB, 확장은 `citext`·`pgcrypto` 뿐이며 둘 다 Azure 에서 지원된다 [문서]. 돈 관련 제약·트리거도 그대로 간다.

어려운 것은 DB 가 아니라 **Supabase 가 DB 위에 얹어 준 세 가지**다.

1. **REST 계층** — 앱의 모든 데이터 접근(약 80개 파일, 약 320곳)이 SQL 이 아니라 supabase-js → PostgREST HTTP 호출이다. Azure PostgreSQL 에는 이 계층이 없다.
2. **인증** — 약 790개 로그인 계정과 사전등록 행 연결 규칙(ADR-0013)이 `auth.users` 트리거에 묶여 있다.
3. **스토리지** — 서명 URL 버킷 1개 (현재 객체 0개라 이전 부담은 작음).

그래서 답은 이렇다.

- **"전부 Azure" 가 목표라면 → 예, 목적지는 Azure Database for PostgreSQL Flexible Server 가 맞다.** Supabase 를 Azure 위에 셀프호스팅하는 길(2)은 관리형 Postgres 에서는 성립하지 않고, VM 에 올리면 1인 운영 부담이 지금보다 커져 권하지 않는다.
- **다만 "지금 옮기는 것이 좋은가" 는 별개다.** 옮겨서 얻는 것은 ① DB 가 도쿄 → 서울로 와서 쿼리당 왕복 지연 감소 (도쿄–서울 RTT 약 30 ms [추정] × 페이지당 순차 쿼리 수), ② 클라우드 단일화, ③ Supabase Free 일시정지·1,000행 제한 같은 제약 탈출이다. 대가는 20~30일의 재작성과 인증 재작성 위험이며, 그 시기가 **유료 시트 라이브 전환 직후**와 겹친다.

## 4. 권고 — 단계적 이전, 시작은 라이브 안정화 뒤

| 단계 | 범위 | 조건 | 기간 |
|---|---|---|---|
| **0단계** | 아무것도 옮기지 않음. 크레딧 조건 확인, 대상 구독·격리 설정 준비, 토스 라이브 전환 완료 | 지금 | 1~2주 |
| **1단계 (권고)** | 길 1 — 호스팅을 App Service, 크론을 Functions 타이머, 관측을 Application Insights, 비밀을 Key Vault 로. Supabase·Resend·토스·Cloudflare DNS 유지 | 토스 라이브 후 2주 무사고 | 5~8일 + 병행 1주 |
| **2단계 (조건부)** | 길 3 — Azure PostgreSQL + Drizzle/Kysely + Auth.js + Blob. 착수 전 길 2′ PoC(1일)로 쿼리 재작성량을 줄일 수 있는지 판정 | 아래 조건 중 하나: 크레딧이 2년 가까이 유효 / Supabase 유료 전환이 필요해짐 / 창업자가 단일 클라우드를 명시적으로 원함 | 20~30일 + 병행 2주 |

1단계를 먼저 하는 이유:
1. **되돌리기가 쉽다** — DNS 한 줄로 Cloudflare Pages 로 복귀 가능. 데이터는 건드리지 않는다.
2. **2단계의 선행 조건이다** — 2단계의 앱은 어차피 Node 런타임이어야 하고(Postgres 드라이버), 1단계가 그것을 먼저 운영 검증한다.
3. **지금 있는 문제 두 개를 고친다** — GitHub 크론 3~6시간 지연(리마인더가 KST 01시 전후 도착, WORKLOG 10-04)과 관측성 공백(Sentry 등 없음, 사고는 지금까지 원장 대조로만 발견).

## 5. 반대 논거 — "옮기지 않는 편이 낫다"

가장 강한 논거: **지금 0원으로 잘 돌고, 토스가 막 승인됐다. 이전은 위험만 더하고 크레딧이 끝나면 매달 돈이 나간다. 그리고 크레딧은 어차피 다 못 쓴다.**

수치로 답하면:
- 크레딧 후 비용: 1단계 월 약 $13 (약 1.9만원), 2단계까지 월 약 $37 (약 5.2만원) [04-cost.md]. 시트 1개당 플랫폼 몫 약 270~300원 기준, 1단계는 월 **약 65시트**, 2단계는 **약 175시트** 분의 마진이다. 현재 유료 주문 한 자릿수 규모에선 작지 않다.
- 크레딧 소진: 투자사 없는 기본 $1,000(90일) + $4,000(180일) 기준 [문서], 2단계 구성으로 9개월에 쓰는 돈은 약 $330 — **약 $4,600 은 쓰지 못하고 만료**된다. "크레딧 활용 실적" 만으로는 이전 이유가 되지 않는다.
- 크론 지연은 Azure 없이도 고칠 수 있다 (Cloudflare Worker 크론, 무료).

그래서 이 계획은 **지금 전부 이전하는 것을 권하지 않고**, 1단계를 "되돌릴 수 있는 시험"으로, 2단계를 창업자의 목적이 확인된 뒤의 선택으로 둔다. 창업자가 이전의 목적을 "크레딧 실적" 이 아니라 "장기적으로 Azure 단일 운영(예: Azure OpenAI 연계, 서울 리전)" 으로 답하면 2단계 권고 강도가 올라간다 → [08-founder-questions.md](08-founder-questions.md).

## 6. 2단계 세부 선택 (진행 시)

| 항목 | 권고 | 대안 | 이유 |
|---|---|---|---|
| 쿼리 | Drizzle ORM (또는 Kysely) + `pg` | PostgREST 자체 운영(2′) | 타입 안전, 임베드 → 명시 조인으로 PGRST201 류 사고 소멸. 2′ 는 PoC 결과로 결정 |
| 인증 | **Auth.js v5** (Google + Credentials) + 자체 `app_auth` 스키마 | Entra External ID (5만 MAU 무료) | 기존 bcrypt 해시와 사용자 UUID 를 그대로 가져올 수 있다. Entra 는 비밀번호 해시 이전 불가로 이메일 회원 재설정 필요 [추정], 한국어 UX·브랜딩 설정 부담 |
| 스토리지 | Blob (Hot LRS) + 사용자 위임 SAS 1시간 | — | 현행 서명 URL 1시간과 동일 |
| 메일 | **Resend 유지** | ACS Email | ACS 기본 시간당 100통, 증액은 지원 요청·최대 72시간 심사 [문서] |
| 사용자 ID | Supabase `auth.users.id` UUID 를 그대로 새 인증 사용자 ID 로 | 재발급 | `users.auth_user_id` FK 재매핑 불필요 |
