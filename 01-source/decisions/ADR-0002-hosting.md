# ADR-0002: 호스팅 — Cloudflare Pages + Supabase

- **상태**: Accepted (2026-05-04 잠금)
- **결정자**: nakjun
- **관련**: 01-source/spec/08_tech_stack.md §1, §2.1, §2.2

---

## Context

Tester Match는 결제·수익이 발생하는 상업 서비스. 호스팅 선택은 비용·약관·운영 부담에 직결.

### 후보

| 안 | 무료 한도 | 상업 사용 | 함정 |
|---|---|---|---|
| A. Vercel Hobby + Supabase Free | bandwidth 100GB/월 | ❌ **약관 위반** ("non-commercial, personal use only") | 적발 시 사이트 강제 정지 + 강제 업그레이드 |
| B. Vercel Pro $20/월 + Supabase Free | bandwidth 1TB/월 | ✅ | $20/월 고정비 즉시 발생 |
| C. **Cloudflare Pages + Supabase Free** | **bandwidth 무제한** | ✅ 명시적 OK | Edge Runtime 제약(sharp 등 wasm 대체 필요), Supabase Free 1주 비활성 시 자동 정지 |
| D. Self-hosted (Hetzner/AWS) | — | ✅ | 1인 운영 부담 큼, 정전·보안·백업 직접 관리 |

---

## Decision

**C안 — Cloudflare Pages + Supabase**.

- 프론트/SSR/Functions: Cloudflare Pages (무료, 상업 OK, bandwidth 무제한)
- DB/Auth/Storage: Supabase Free → Pro 전환 (첫 결제 발생 또는 동시 매칭 10건 도달 시점)
- DNS/WAF/DDoS/CDN: Cloudflare 통합 (무료)
- 백그라운드 잡: Cloudflare Cron Triggers (무료, Inngest 대안)
- 도메인: Cloudflare Registrar (원가 $10/년)

### 이중화 (단일 장애 회피)
- 이메일: Resend(메인 100/일) + Brevo(백업 300/일) 자동 라우팅
- Supabase 일시정지 방지: UptimeRobot 5분 ping + Cloudflare Cron 6시간 SELECT 1
- 결제: 토스페이먼츠 단일 (v2 Stripe 추가 시 자동 fallback)

---

## Why

1. **약관 안전**: Vercel Hobby는 명시적으로 비상업 사용만 허용 → 결제 발생 순간 위반. Cloudflare Pages는 상업 사용 명시적 OK.
2. **무료 한도 여유**: Cloudflare Pages bandwidth 무제한, Functions 100K/일. v1 예상 트래픽 대비 ∞ 여유.
3. **고정비 0원**: 1년차 도메인($10/년) 외 인프라 비용 0원. 매출 발생 시점에 Supabase Pro($25/월) 전환만 필요.
4. **Cloudflare 생태계 통합**: DNS/WAF/Cron/CDN/Registrar 한 콘솔에서 관리. 운영 부담 최소.
5. **Supabase 단일화**: DB + Auth + Storage + Edge Functions 통합 → 1인 개발 효율. RLS로 백엔드 코드 절감.

---

## Consequences

### 긍정
- 1년차 인프라 고정비 약 1만원 (도메인만)
- bandwidth 무제한 → SEO 콘텐츠 트래픽 폭증해도 비용 0
- Cloudflare WAF/DDoS 무료 무제한 → 보안 기본기 확보

### 부정
- Cloudflare Pages Edge Runtime 제약: 일부 Node native API 미지원 (sharp → @cloudflare/images 또는 wasm 대체)
- Supabase Free 1주 비활성 시 자동 정지 → UptimeRobot ping 필수
- Cloudflare Functions bundle size 25MB 제약 → 의존성 관리 신중
- v3 모바일 앱 진출 시 Edge Functions의 cold start latency 재검토 필요

### 결정 갱신 트리거
- Cloudflare Functions 100K/일 임박 → Workers Paid $5/월 전환
- Supabase Free 안정성 이슈 발생 → Pro $25/월 즉시 전환 (적어도 첫 결제 발생 시점에는 전환)
