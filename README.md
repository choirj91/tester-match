# Tester Match

Google Play Closed Testing 12명/14일 요건을 해소하는 한국형 품앗이 매칭 플랫폼.

> **현재 상태**: 기획 완료 + 핵심 결정 3종 잠금. **코드 미시작 (12주 MVP 대기)**.
> **마지막 업데이트**: 2026-05-04

---

## 30초 진입 가이드

처음 들어왔다면 다음 순서로:

1. [01-source/bp/Tester_Match_사업계획서_v0.1.md](01-source/bp/Tester_Match_사업계획서_v0.1.md) — 한 줄 요약과 결정 스냅샷 (§1) 만 보면 충분
2. [01-source/decisions/](01-source/decisions/) — 잠금 결정 3종 (왜 이렇게 정했나)
3. [NEXT.md](NEXT.md) — 이번 주 액션 + 12주 로드맵 현재 위치
4. [01-source/spec/README.md](01-source/spec/README.md) — 기획 문서 9종 인덱스 (역할별 읽는 순서)

---

## 잠금 결정 (2026-05-04)

| # | 결정 | 한 줄 |
|---|---|---|
| 1 | **타겟 시장** | 한국 우선 (KRW, 한국어 UI). 영어권은 v2 |
| 2 | **호스팅** | Cloudflare Pages + Supabase. Vercel 비채택 |
| 3 | **크레딧 모델** | 1원 = 1 크레딧. 1매칭 = 1,000원 (테스터 800원 + 플랫폼 200원) |

→ 상세 근거: [01-source/decisions/](01-source/decisions/)

---

## 5레이어 구조

| 폴더 | 역할 | 수정 가능 여부 |
|---|---|---|
| `01-source/` | 원천 (BP, 기획서 9종, ADR, 리서치) | **읽기 전용** |
| `02-reference/` | 참조 (UI 미리보기, 코드 패턴, 예시) | 추가만 |
| `03-output/` | 산출물 (Next.js 앱, Supabase, 인프라, 정책) | 자유 |
| `04-review/` | 품질관리 (세션 이력, QA, 감사, 피드백) | 누적 |
| `05-harness/` | 엔진 (스킬, 템플릿, 워크플로우, 채점기준) | 점진 |

상세 규칙: [CLAUDE.md](CLAUDE.md)

---

## 빠른 시작 (다음 작업자용)

```bash
# 1. 컨텍스트 파악 (10분)
cat README.md NEXT.md
ls 01-source/decisions/

# 2. 코드 시작 시 (12주 로드맵 Week 1~2)
cd 03-output/app
# Next.js 15 + Supabase 스켈레톤 셋업
```

---

## 기술 스택 (요약)

| 계층 | 선택 |
|---|---|
| 프론트 | Next.js 15 (App Router) + Tailwind |
| 호스팅 | Cloudflare Pages |
| 백엔드/DB/Auth | Supabase (Free → Pro) |
| 결제 (v1) | 토스페이먼츠 (KRW) |
| 결제 (v2) | Stripe (USD) — 영어권 확장 시 |
| 이메일 | Resend (메인) + Brevo (백업, 100/일 + 300/일) |
| 백그라운드 | Cloudflare Cron Triggers |
| 모니터링 | Sentry Free + PostHog Free + UptimeRobot |

상세: [01-source/spec/08_tech_stack.md](01-source/spec/08_tech_stack.md)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-04 | 기획 9종 + BP v0.1 작성, 결정 3종 잠금, 5레이어 하네스 구조 셋업 |
