# Tester Match 개발 인수인계 가이드 — 수정·기능 개발 맡기기

> 기준: 2026-10-21, `origin/main` `0be227e` (PR #22 까지). 운영 중인 서비스다.
> 독자: 이 플랫폼의 수정·기능 개발을 사람(외부 개발자)이나 AI 세션에게 맡기려는 대표, 그리고 받는 사람.
> 공개 저장소에 두는 문서다. 비밀값·테넌트/구독 ID·계정 메일·운영 데이터는 적지 않는다.

## 0. 한 줄 원칙

**받는 사람은 PR 까지만 한다. 운영 DB 적용·배포 승인·외부 콘솔은 대표가 계속 쥔다.** 작업은 "작업 지시서" 한 장(4절) 단위로 맡긴다.

---

## 1. 넘기기 전에 대표가 정리할 것 (차단 항목)

위에서부터 위험한 순서다. 1~4 는 넘기기 전에 끝내야 한다.

| # | 문제 | 그대로 넘기면 | 조치 |
|---|---|---|---|
| 1 | **DB 마이그레이션 절차가 틀려 있다.** `DEPLOY.md` "DB 마이그레이션" 절과 `.claude/skills/tm-deploy` 1단계가 아직 `npx supabase db push` | 2026-10-05 이후 운영 DB 는 Azure PostgreSQL 이다. `supabase db push` 는 옛 Supabase(롤백용 사본)에만 적용된다 → 운영에는 새 열·함수가 없는 채로 코드가 배포되어 PGRST204/202 오류 | 두 문서를 실제 절차로 고친다: `psql "$PG_ADMIN_URI" --single-transaction -v ON_ERROR_STOP=1 -f <파일>` → 같은 DB 에 `notify pgrst, 'reload schema';` → 코드 배포. 실행은 대표만 |
| 2 | **최신 작업 규칙·로그가 이 맥에만 있다.** main 체크아웃(다른 세션 브랜치 `feat/seat-escrow`)에 미커밋 `CLAUDE.md`(행동 지침 71줄 추가)·`NEXT.md`·`WORKLOG.md`·`.claude/launch.json`, 미추적 `AGENTS.md`·`.claude/settings.json` | main 의 `WORKLOG.md` 는 10-05 에서 멈춰 있다. 받는 사람이 클론하면 10-06 이후 기록과 행동 지침을 못 본다 | 비밀값이 없는지 확인하고 main 에 반영한다. **덮어쓰지 말고 합칠 것**: 로컬 `CLAUDE.md` 의 잠금 결정 3번은 main 보다 옛 값(1,000원)이다 — 행동 지침 블록만 옮긴다. `AGENTS.md` 는 잠금 결정 2번이 옛 값(Cloudflare+Supabase) — CLAUDE.md 와 같게 맞추거나 지운다 |
| 3 | **GitHub 권한 구조가 외부 작업자를 전제하지 않는다.** `main` 브랜치 보호 없음, 저장소 비밀 `CRON_SECRET`·`APP_URL` 이 저장소 수준(Environment 아님) | Write 권한을 받은 사람은 main 에 바로 push 할 수 있고, 브랜치에 워크플로를 올려 `CRON_SECRET` 을 꺼낼 수 있다 (운영 크론 — 페널티 스윕·리마인더 메일 — 호출 가능) | 외부 개발자에게는 **Write 를 주지 말고 fork → PR** 로 받는다 (저장소 공개, CI 는 비밀 없이 돈다). Write 를 꼭 줘야 하면 먼저 ① main 보호(PR 필수·CI 통과 필수) ② `CRON_SECRET` 을 승인자 있는 Environment 로 옮기거나 저장소 비밀에서 삭제(정기 실행은 이미 Azure Functions) |
| 4 | **외부 개발자가 로컬 DB 를 만들 길이 없다.** `tm-dev local-init` 은 `~/.config/tester-match/prod-db.env` 의 운영 관리자 URI 로 운영 스키마를 읽어 온다 | 운영 접속 정보를 넘기거나, 로컬 없이 운영 DB 로 개발하게 된다 (둘 다 금지) | 대표가 스키마 전용 덤프(데이터 없음)를 만들어 전달하고 `local-init` 이 그 파일로도 돌게 고친다. 또는 마이그레이션 53개로 빈 DB 를 재구성할 수 있는지 확인한다 [확인 필요 — 처음부터 다시 쌓아 본 기록 없음] |
| 5 | **옛 문서** | 받는 사람이 폐기된 구조를 믿는다 | `README.md`(코드 미시작·Cloudflare·토스로 적힘), `DEPLOY.md` "크론" 절(정기 실행은 이미 Functions 로 옮김, cron.yml 은 수동 전용), `NEXT.md` 머리말(pages.dev), `tm-session` 스킬의 잠금 결정 요약(Cloudflare+Supabase), `06-isolation-runbook.md` 래퍼 코드(구현 전 설계안) |
| 6 | **이 맥에만 있는 운영 지식** (Claude 메모리) | 다른 맥·다른 사람의 AI 는 모른다 | 문서로 옮긴다 (ID 없이): 운영 SQL 은 psql 관리자 접속만 / `supabase --linked` 는 롤백 사본만 / `.env.local` 이 운영 DB 를 가리킬 수 있어 로컬 개발은 `tm-dev local` / 여러 세션이 체크아웃을 공유 / Azure 배포 사실 |
| 7 | 정리 | — | 미푸시 브랜치 `docs/azure-isolation-guide` 병합, 워크트리 13개 중 끝난 것 정리 |

## 2. 누구에게 무엇을 주나

| 받는 사람 | 주는 것 | 주지 않는 것 |
|---|---|---|
| **이 맥의 새 AI 세션** (Claude·Codex) | 이미 다 있다: CLAUDE.md·스킬·메모리 자동 로드, `tm-dev`·`tm-az` | — (규칙은 CLAUDE.md 가 막는다) |
| **외부 개발자** (사람 + 그 사람의 AI) | 저장소 주소(공개) → fork·PR, 로컬 DB 스키마 덤프(1-4), 작업 지시서, 이 문서 | `azure-prod` 승인자 권한, Azure 역할, Key Vault, 운영 DB 접속 정보(`~/.config/tester-match/*.env`), 운영 비밀값, PortOne·KG이니시스·Resend·Google Cloud·Google 그룹·Slack·오픈채팅 관리자 |
| **장기 담당자** (운영까지 넘길 때) | 위 + 단계적으로: GitHub Write(1-3 정리 후) → 운영 DB **읽기 전용** 역할 → Azure 는 그 사람 계정에 `rg-testermatch-prod-krc` 범위 최소 역할 + 그 사람 맥에 같은 격리 구조(`azure-account-isolation-guide.md`) | 대표 계정 공유. 계정은 사람마다 따로 만든다 |

- **비밀값은 채팅·메일로 보내지 않는다.** 필요하면 받는 사람이 자기 맥에서 직접 입력하는 방식(Key Vault `--file`, 600 권한 파일)으로.
- **배포 게이트는 대표에게 남긴다.** `azure-prod` Environment 의 Required reviewers 가 대표 1명이라, 누가 워크플로를 실행해도 대표 승인 없이는 운영에 안 나간다.

## 3. 받는 사람의 첫날

**읽는 순서 (약 1시간)**

1. `CLAUDE.md` — 작업 규칙, 잠금 결정 3개, 절대 금지
2. `NEXT.md` 🔥 즉시 · `WORKLOG.md` 최근 항목 — 지금 무엇이 진행 중인가
3. `DEPLOY.md` — 배포 절차와 사고 이력 (1-1·1-5 정리 후)
4. ADR — 현재 구조는 `ADR-0015`(Azure), 돈 흐름은 `ADR-0017`(1,100원·보상 전용 크레딧·KG이니시스)·`ADR-0018`(급구 유료화)·`ADR-0020`(보상 교환). 나머지는 필요할 때
5. 화면 작업이면 `03-output/design/C-implementation-report.md` (Design C 규칙)

**실행**

```bash
# Node 20.11 이상, pnpm 9.12.3 (corepack enable)
cd 03-output/app
pnpm install
```

```bash
# 로컬 DB (이 맥: 아래 3줄. 외부 개발자: 1-4 에서 받은 방법으로)
05-harness/scripts/tm-dev setup
05-harness/scripts/tm-dev local-init
05-harness/scripts/tm-dev local
```

```bash
cd 03-output/app && pnpm dev
```

`tm-dev local` 은 메일 발송을 끄고 크론 경로를 닫고 Google 로그인을 끈다(이메일 로그인만). 그래도 **로컬 서버의 `/api/cron/*` 에는 어떤 요청도 보내지 않는다** (2026-10-04 운영 페널티 스윕 사고).

**검사** (CI 와 같음 — PR 전에 통과시킬 것)

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm build
```

**첫 과제**로 문구 한 줄 수정 PR 을 끝까지 돌려 본다 (브랜치 → 테스트 → PR → 리뷰 → 대표 배포).

## 4. 작업 맡기는 법 — 작업 지시서

작업마다 아래 한 장을 채워 넘긴다. 빈칸이 있으면 받는 사람이 추측하게 된다.

```
제목:
목표: (사용자 관점 한 줄 — 누가 무엇을 할 수 있게 되나)
배경: (문의 원문·NEXT 항목·관련 ADR 링크)
완료 기준: (확인 방법 — 화면 경로, 테스트 이름, 수치)
범위: 건드려도 되는 곳 / 건드리면 안 되는 곳
승인 필요: 결제·정책·약관·크레딧 문구? DB 스키마? 새 외부 서비스·비용?
산출물: PR 1개 (테스트 포함, 마이그레이션 파일이 있으면 적용은 대표)
마감·우선순위:
```

## 5. 작업 흐름과 역할

| 단계 | 받는 사람 | 대표 |
|---|---|---|
| 1. 브랜치 | 최신 `main` 에서 `feat/…`·`fix/…` (이 맥이면 워크트리에서 — 다른 세션과 체크아웃 공유) | — |
| 2. 구현 | 코드 + 테스트. 환불·결제는 멱등성 테스트, 14일 카운트는 시간대 테스트 필수 | — |
| 3. DB 변경 | `03-output/supabase/migrations/<YYYYMMDD><6자리 순번>_<이름>.sql` 추가(예: `20261009000001_member_gain_report.sql`, 다른 작업과 번호가 겹치지 않게), **로컬에만** 적용. PR 에 되돌리는 방법 한 줄 | — |
| 4. PR | CI 통과, 커밋 메시지 영어, 화면 변경이면 스크린샷 | — |
| 5. 리뷰 | — | 코드 리뷰 (또는 리뷰 에이전트) + 승인 필요 항목 결정 |
| 6. 병합·배포 | — | 운영 마이그레이션(psql → `notify pgrst`) → **그다음** 배포 워크플로 실행·승인 → 운영 확인 |
| 7. 기록 | PR 본문 | `WORKLOG.md`·`NEXT.md` 갱신, 큰 결정은 ADR |

순서 주의: **마이그레이션 먼저, 코드 배포 나중.** 거꾸로 하면 새 코드가 없는 열·함수를 불러 오류가 난다.

## 6. 받는 사람이 반드시 지킬 것 (전문은 CLAUDE.md)

- **잠금 결정 3개**: 한국 우선(KRW·한국어·KST) / Azure 전용 인프라 / 1원 = 1크레딧, 테스터 시트 1명 = 1,100원, 크레딧은 보상 전용. 바꾸려면 ADR 먼저
- **문구**: 크레딧 맥락에서 "구매·충전·환전·현금·환급" 금지, "보상·보상 교환·복구" 사용 (ADR-0017 7항 — PG 심사 조건)
- **결제·정책·약관·크레딧 문구 변경은 대표 승인**
- **Google Play 리뷰·별점 인센티브 기능 금지** (F-RVW-*)
- **공개 저장소**: 비밀값·테넌트/구독 ID·운영 추출 데이터 커밋 금지
- `01-source/` 수정 금지 (ADR 추가만), `--force`·`--no-verify` 금지
- 화면: Design C 규칙 (`components/ui`, lucide 아이콘, rounded·그림자·이모지 금지, 크레딧 옆 ₩·원 금지)
- Azure 를 만질 일이 생기면 `azure-account-isolation-guide.md` (래퍼로만, 회사 계정 혼용 금지)

## 7. 전체 문서 세트가 필요할 때

장기 담당자에게 넘기거나 투자·파트너 설명까지 필요하면 `05-harness/templates/handover-meta-prompt.md` 를 새 AI 세션에 붙여 `03-output/handover/` 에 문서 12종(데이터 모델·기능 흐름·위험·창업자 질문 등)을 만든다. 읽기 전용 작업이고 시간이 오래 걸린다. **1절 정리를 먼저 끝낸 뒤** 돌려야 낡은 상태를 문서화하지 않는다.

## 8. 인수인계가 끝났는지 확인

받는 사람이 문서만 보고 아래에 답하고, 첫 PR 이 대표 배포까지 한 바퀴 돌았으면 끝이다.

1. 버튼 문구 하나를 운영에 반영하려면 누가 어떤 순서로 무엇을 하나? 하면 안 되는 것은?
2. 새 열이 필요한 기능은 어떤 순서로 배포되나?
3. 크레딧 관련 화면에 쓰면 안 되는 단어는? 왜?
4. 로컬에서 절대 호출하면 안 되는 경로는? 왜?
5. 결제 문구를 바꾸고 싶으면 누구에게 무엇을 받아야 하나?
