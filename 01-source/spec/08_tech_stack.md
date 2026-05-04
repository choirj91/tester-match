# 기술 스택 — 무료 호스팅 우선 전략 (Tester Match v1)

> 작성일: 2026-05-04 / Version: v0.1
> 본 문서는 **MVP 출시까지 비용을 최소화하는 무료 우선(Free-First) 전략**을 정의한다.
> 모든 수치는 2026년 5월 기준 공식 문서 확인값이며, 출처는 마지막 절에 정리.

---

## ⚠️ 시니어 관점 — 반드시 짚어야 할 3가지 함정

본격 진행 전, 흔히 놓치는 사실 3가지를 먼저 정리합니다.

### 함정 1. Vercel Hobby Plan은 "비상업적 개인 사용만" 허용

> The Hobby plan **restricts users to non-commercial, personal use only**. — Vercel 공식 문서

Tester Match는 결제·수익이 발생하는 **상업 서비스**이므로, Vercel Hobby(무료)를 쓰는 순간 **약관 위반**입니다. 적발 시 사이트 강제 정지 + 강제 업그레이드 청구 가능. 많은 인디 개발자가 이 사실을 모르고 시작했다가 PMF 직전에 강제 차단되는 사례가 빈번합니다.

→ **결론**: Vercel은 "Pro $20/월 또는 사용 안 함" 두 가지 선택지뿐. 무료를 원한다면 **Cloudflare Pages**(상업 OK + 무제한 bandwidth)가 정답.

### 함정 2. Supabase Free는 1주 비활성 시 자동 일시정지

> Free projects are **automatically paused after one week of inactivity**. — Supabase 공식 문서

오픈 직후 트래픽이 없는 1주일이 지나면 DB가 자동 일시정지되어 사이트 전체가 죽습니다. 새벽에 일어나서 unpause 누르는 경험을 하게 됩니다.

→ **결론**: (1) UptimeRobot 무료 모니터링으로 5분 간격 ping → 일시정지 방지, 또는 (2) Pro $25/월 즉시 전환.

### 함정 3. Resend Free의 진짜 한도는 "100통/일"

월 3,000통이지만 **하루 100통이 하드 캡**입니다. Tester Match의 14일 체크인 시스템은 다음 트래픽이 발생합니다:

| 시나리오 | 일일 메일 발송량 |
|---|---|
| 동시 진행 매칭 5건 (=60명) | 매일 60통 (체크인) + 매칭/결제 알림 |
| 동시 진행 매칭 10건 | 120통 (체크인만) → **이미 한도 초과** |

→ **결론**: v1에서도 매칭 10건만 동시 진행되면 Resend 무료 한도 초과. 백업으로 **Brevo (구 Sendinblue) 300통/일 무료** 또는 **Mailgun 5,000통/월** 병용 필요.

---

## 1. 권장 무료 우선 스택 (Free-First Stack)

### 1.1 최종 권장 (한 표 요약)

| 계층 | 권장 서비스 | 무료 한도 | 상업 사용 | 비고 |
|---|---|---|---|---|
| **호스팅** | **Cloudflare Pages** | 무제한 bandwidth, 500 deploys/월 | ✅ 명시적 OK | Next.js SSR 지원 |
| **DB + Auth + Storage** | **Supabase Free** | 500MB DB, 50K MAU, 1GB Storage | ✅ | 1주 비활성 = 자동 정지 (모니터링 필수) |
| **이메일 (메인)** | **Resend** | 3,000/월, **100/일** | ✅ | 1 도메인 한정 |
| **이메일 (백업/오버플로우)** | **Brevo (구 Sendinblue)** | 300/일 무료 | ✅ | Resend 한도 초과 시 자동 라우팅 |
| **결제 (국내)** | **토스페이먼츠** | 계정 무료, 거래 시 2.5% | ✅ | 사업자등록 필요 |
| **결제 (해외)** | **Stripe** | 계정 무료, 거래 시 2.9% + $0.3 | ✅ | v2 글로벌 대비 |
| **백그라운드 잡** | **Cloudflare Cron Triggers** | 무료, 분당 1회 | ✅ | Inngest 50K/월 대안 |
| **에러 모니터링** | **Sentry Free** | 5K errors/월, 50 replays | ✅ | 매우 제한적 — Better Stack 검토 |
| **행동 분석** | **PostHog Free** | 1M events/월 | ✅ | 가장 관대 |
| **DNS + WAF + CDN** | **Cloudflare** | 무제한 | ✅ | 도메인 별도 ($10/년) |
| **소스 관리/CI** | **GitHub** | 무제한 public repo, 2K min/월 (Actions) | ✅ | private 무료 |
| **도메인** | **Cloudflare Registrar** | 원가 ($10/년 .com) | ✅ | 가장 저렴 |

### 1.2 1년차 예상 고정비 — **합계: 약 12,500원/월 (도메인만)**

| 항목 | 1년차 비용 |
|---|---|
| 도메인 (.com) | $10/년 (≈ 1만원) |
| 호스팅 + DB + Auth + 이메일 + Cron + 모니터링 | **무료** (위 한도 내) |
| **합계** | **연 1만원 (월 약 1,000원)** |

> 단, 결제 발생 시 PG 수수료(거래액의 2.5~3%)는 별도. 매출 0원이면 고정비 0원.

---

## 2. 각 서비스 상세 — 무료 한도와 우리 트래픽 비교

### 2.1 Cloudflare Pages — 호스팅

| 항목 | 무료 한도 | Tester Match v1 예상 | 여유율 |
|---|---|---|---|
| Bandwidth | **무제한** | 월 50~100GB | ∞ |
| Deployments | 500/월 | 월 약 30 (CI/CD) | 16x |
| Build minutes | 500/월 | 월 약 200분 | 2.5x |
| Functions invocations | 100K/일 (3M/월) | 일 약 5만 | 2x |
| Concurrent builds | 1 | 1 | 1x |
| Custom domains | 무제한 | 1~2 | ∞ |

**왜 Vercel이 아닌가?**
1. Vercel Hobby는 상업 서비스 약관 위반 (위 함정 1 참조)
2. Cloudflare Pages는 **bandwidth 무제한** (Vercel Pro도 1TB 제한)
3. Cloudflare Workers/Functions와 통합 (cron, KV 등 무료 활용)

**Next.js 호환성**
- App Router, Server Components, Server Actions: ✅ 지원
- Edge Runtime: 기본 (Vercel과 차이 거의 없음)
- ISR/On-demand revalidation: KV 통한 구현 가능

**제약**
- Bundle size: 25MB (압축 후) — 일반 Next.js 앱 충분
- Function CPU time: 30초 (충분)
- 일부 Node.js native API 미지원 (sharp 등 → wasm 대체 필요)

---

### 2.2 Supabase — DB + Auth + Storage

| 항목 | 무료 한도 | Tester Match v1 예상 | 비고 |
|---|---|---|---|
| Database 용량 | 500MB | 1년차 약 50~100MB | 5x 여유 |
| Database row | 약 2~5M | 1년차 약 50K | 100x 여유 |
| Database egress | 5GB/월 | 약 1GB | 5x |
| Monthly Active Users (Auth) | **50,000** | 1년차 1,500명 | 33x |
| File Storage | 1GB | 약 100MB (스크린샷) | 10x |
| Storage egress | 5GB/월 | 약 500MB | 10x |
| Edge Functions | 500K invocations/월 | 약 100K | 5x |
| Realtime concurrent | 200 | 50 | 4x |
| 동시 DB 커넥션 | 60 | < 60 | 1x |

**⚠️ 자동 일시정지 대응**

> Free projects are automatically paused after **1 week of inactivity**.

대응 방법 3가지:

1. **UptimeRobot 무료 모니터링** (권장)
   - 5분 간격 HTTP ping → 일시정지 방지
   - 무료 50개 모니터까지
   - 동시에 다운타임 알림 기능 무료
   - 약관상 정상 모니터링이라 OK

2. **Cloudflare Cron Triggers로 매시간 SELECT 1 실행**
   - 약관상 회색지대 (인공적 활동 유지)

3. **Pro $25/월 업그레이드**
   - 첫 결제 발생 또는 동시 매칭 10건 도달 시점 권장

**용량 운영 팁**
- audit_logs는 90일 후 자동 삭제 (cron job)
- 스크린샷은 압축 후 저장 (300KB 이하 강제)
- 첫 1년 내 500MB 도달 가능성 < 1%

---

### 2.3 Resend + Brevo — 이메일 (이중화 필수)

#### Resend Free
| 항목 | 한도 |
|---|---|
| 월 발송 | 3,000통 |
| **일일 한도** | **100통** ⚠️ |
| 도메인 | 1개 (Pro부터 무제한) |
| API/SMTP | 모두 지원 |

#### Brevo (구 Sendinblue) Free — 백업
| 항목 | 한도 |
|---|---|
| **일일 한도** | **300통** ✅ |
| 월 발송 | 약 9,000통 |
| 도메인 | 무제한 |

**우리의 메일 트래픽 추정 (동시 매칭 10건 가정)**

| 종류 | 일일 발송 |
|---|---|
| 14일 체크인 알림 | 120통 (10건 × 12명) |
| 매칭 성사 알림 | ~20통 |
| 결제 영수증 | ~5통 |
| 가입 환영 | ~10통 |
| 기타 (환불·페널티) | ~5통 |
| **합계** | **약 160통/일** |

→ Resend 100통/일 단독으로는 부족. **Resend(주력) + Brevo(체크인 전용 fallback)** 이중 구성.

**구현 패턴**
```typescript
async function sendEmail(payload: EmailPayload) {
  const todayCount = await getResendDailyCount();
  if (todayCount < 90) {
    return await resend.send(payload);
  }
  return await brevo.send(payload);
}
```

---

### 2.4 결제 — Stripe + 토스페이먼츠

**비용 구조 (계정 무료, 거래 시에만 수수료)**

| 결제 수단 | 수수료 |
|---|---|
| 토스페이먼츠 (국내 신용카드) | 2.5%~3.0% |
| 토스페이먼츠 (간편결제: 카카오페이/네이버페이) | 2.5%~3.5% |
| 토스페이먼츠 (계좌이체) | 1.5% |
| Stripe (해외 카드) | 2.9% + $0.30 |
| Stripe Tax (자동 세금 계산) | 0.5% (선택) |

**v1 구현 권장**
- 1차 출시: **토스페이먼츠만** (국내 우선 결정 반영)
- v2: Stripe 추가 (글로벌 영어권 확장 시점)
- 두 PG 모두 webhook 동일 인터페이스로 추상화 → 추가 PG 손쉽게 확장

---

### 2.5 백그라운드 잡 — Cloudflare Cron Triggers (무료)

**주요 Cron 작업**
| 잡 | 빈도 | Cloudflare에서 가능? |
|---|---|---|
| 일일 체크인 알림 발송 | 매일 1회 (사용자별 시각) | ✅ |
| 14일 만료 카운트 체크 | 매일 1회 | ✅ |
| Boost SLA 마감 체크 | 매분 | ✅ |
| 미체크인 5일 연속 페널티 | 매일 1회 | ✅ |
| Supabase 일시정지 방지 ping | 6시간마다 | ✅ |
| audit_logs 90일 정리 | 매주 1회 | ✅ |

→ **Cloudflare Cron Triggers는 완전 무료**. Inngest의 50K runs/월보다 단순한 cron 작업에는 더 적합.

복잡한 워크플로우(retry, 분기 등)가 필요해지면 **Inngest 50K/월** 추가 도입.

---

### 2.6 에러 모니터링 — Sentry Free의 한계

| 항목 | Sentry Free | 우리 예상 |
|---|---|---|
| Errors | 5,000/월 | 1년차 < 1,000 |
| Replays | 50/월 | < 50 |
| **사용자 수** | **1명** ⚠️ | 운영자 1명 충분 |
| 데이터 보관 | 30일 | 충분 |

→ 1년차에는 Sentry Free로 충분. 단 **1명만 접근 가능**한 점 주의 (팀 합류 시 Pro $26/월 또는 BetterStack 대체 검토).

**대안: BetterStack Logs (구 Logtail)**
- 무료 1GB 로그 수집
- 5명 팀 무료
- Slack 알림 통합

---

### 2.7 행동 분석 — PostHog Free (가장 관대)

| 항목 | PostHog Free | 우리 예상 |
|---|---|---|
| Events | **1,000,000/월** | 1년차 약 100K | 
| Session Replays | 5,000/월 | 약 1,000 |
| Errors | 100,000/월 | < 100 |
| 데이터 보관 | 1년 | 충분 |
| Projects | 1 | 1 |

→ 1M events는 사용자 1,500명 × 일 평균 22개 이벤트 = 약 1M/월. **거의 정확히 무료 한도 내**.

PMF 검증 단계의 분석 도구로 충분하며, 5K 세션 리플레이는 사용자 행동 디버깅에도 충분.

---

## 3. 무료 티어 → 유료 전환 시점 (Tipping Point)

각 서비스별로 "무료 → 유료 전환을 결정해야 할 신호" 정의.

| 서비스 | 전환 신호 | 다음 단계 비용 |
|---|---|---|
| Cloudflare Pages | 함수 호출 100K/일 임박, 또는 Pro 기능 필요 (preview deploy 등) | Workers Paid $5/월 |
| Supabase | DB 400MB 도달 / MAU 40K 도달 / 안정성 필요 | Pro $25/월 |
| Resend | 일 90통 정기 도달 / 도메인 추가 필요 | Pro $20/월 (50K/월) |
| Brevo | 일 250통 정기 도달 | Starter €19/월 |
| Sentry | 팀원 추가 필요 / 5K errors/월 도달 | Team $26/월 |
| PostHog | 800K events/월 도달 | Pay-as-you-go (1M 이후 $0.00005/event) |

**전환 우선순위 권장**: ① Supabase Pro → ② Resend Pro → ③ 나머지

---

## 4. 사용자 규모별 비용 시뮬레이션

| 단계 | 등록 사용자 | 월 매출 | 월 인프라 비용 | Net |
|---|---|---|---|---|
| **Pre-launch** (Week 1~12) | 0~200 | 0원 | 1,000원 (도메인만) | -1,000원 |
| **Soft Launch** (Month 4~6) | 200~500 | 0~30만원 | 1,000원 (전부 무료 가능) | +29만원 |
| **Growth** (Month 7~9) | 500~1,500 | 30~150만원 | 약 5만원 (Supabase Pro 전환) | +145만원 |
| **Scale** (Month 10~12) | 1,500~4,000 | 150~500만원 | 약 12만원 (Resend Pro, Sentry Team) | +488만원 |
| **v2** (Year 2) | 4,000~10,000 | 500만~1,500만 | 약 30만원 | +1,470만원 |

> 핵심: **첫 6개월은 사실상 무료 운영 가능**. 매출이 발생하기 시작하면 안정성을 위해 점진적으로 Pro 전환.

---

## 5. 무료 티어를 최대한 길게 유지하는 7가지 전략

1. **Cloudflare 캐싱 적극 활용** — 정적 리소스는 365일 캐싱 → Functions 호출 최소화
2. **Supabase RLS(Row Level Security)** — 클라이언트가 직접 DB 접근 → API 함수 호출 절감
3. **이메일 발송 큐잉 + 묶음 발송** — 일일 알림은 사용자별 시각에 묶어서 1통으로
4. **이미지 최적화** — Cloudflare Images($5/월)나 next/image WebP 변환 → Storage·Bandwidth 절감
5. **PostHog 이벤트 샘플링** — 페이지뷰는 100% 추적, 마우스 이동·스크롤은 10%만
6. **불필요한 cron 통합** — 5개 cron을 1개로 묶기 (Cloudflare 일일 한도 영향)
7. **Supabase 일시정지 방지 ping은 6시간 간격** — 더 자주 할 필요 없음

---

## 6. 백업·이중화 전략 (단일 장애 지점 회피)

| 핵심 의존 | 단일 장애 | 백업 |
|---|---|---|
| Cloudflare Pages 다운 | 사이트 전체 불가 | Vercel Pro로 fast cutover (DNS만 변경) |
| Supabase 다운 | 모든 기능 불가 | **Neon Read Replica** (무료, 읽기 전용) — 읽기 전용 모드 fallback |
| Resend 다운 | 알림 미발송 | **Brevo 자동 라우팅** (이미 이중화) |
| 토스페이먼츠 다운 | 결제 불가 | Stripe로 자동 전환 (UI에서 옵션 노출) |
| GitHub 다운 | 배포 불가 | GitLab 미러 (자동 동기화) |

> v1 출시 시점에는 모두 구현하지 않아도 됨. **Supabase 백업과 이메일 이중화만 v1 필수**, 나머지는 PMF 검증 후.

---

## 7. 개발·배포 환경

### 7.1 환경 분리

| 환경 | URL | DB | 결제 |
|---|---|---|---|
| Local | localhost:3000 | Supabase 로컬 (Docker) | 토스 테스트 + Stripe 테스트 |
| Preview | `*.testermatch-pages.dev` (CF Pages PR preview) | Supabase Free 별도 프로젝트 | 토스 테스트 + Stripe 테스트 |
| Production | testermatch.com | Supabase Free 본 프로젝트 | 토스 라이브 + Stripe 라이브 |

> Supabase Free는 2 프로젝트만 가능 → Preview는 Local과 공유 가능 (또는 Neon 무료로 Preview 분리).

### 7.2 CI/CD 파이프라인 (GitHub Actions, 무료 2K분/월)

```yaml
# .github/workflows/ci.yml (개념도)
on: [push, pull_request]
jobs:
  test:
    - npm install
    - npm run lint
    - npm run typecheck
    - npm run test          # vitest
    - npm run test:e2e      # playwright (PR만)
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    - cloudflare/pages-action@v1
    - supabase migration up
```

**예상 빌드 시간**: PR당 약 3분 → 월 약 100분 (한도의 5%)

### 7.3 환경 변수 관리

- 로컬: `.env.local` (gitignore)
- Cloudflare Pages: Dashboard → Environment Variables
- 비밀 키 관리: Cloudflare Pages가 자체 암호화 저장 (별도 Vault 불필요)
- 회전 주기: 결제·OAuth 키는 분기 1회 회전

---

## 8. 보안 기본 (무료로 가능한 것들)

| 항목 | 도구 | 비용 |
|---|---|---|
| HTTPS | Cloudflare 자동 | 무료 |
| WAF | Cloudflare 무료 (기본 규칙) | 무료 |
| DDoS | Cloudflare 무제한 | 무료 |
| Bot 차단 | Cloudflare Bot Fight Mode | 무료 |
| Rate Limiting | Cloudflare 무료 (10K req/월) | 무료 |
| Secret 검사 | GitHub Secret Scanning | 무료 (public repo) |
| Dependency 취약점 | Dependabot | 무료 |
| OWASP 스캔 | OWASP ZAP (로컬) | 무료 |

---

## 9. 도메인 전략

| 항목 | 권장 | 비용 |
|---|---|---|
| 메인 도메인 | testermatch.com | $10/년 (Cloudflare Registrar 원가) |
| 영문 alt | testermatch.io | $40/년 (선택) |
| 한국 alt | testermatch.co.kr | 22,000원/년 (선택, v2) |
| 이메일 도메인 | mail.testermatch.com | 무료 (서브도메인) |
| 지원 도메인 | help.testermatch.com | 무료 (서브도메인) |

> **Cloudflare Registrar는 마진 0% 원가 판매**로 가장 저렴. GoDaddy 대비 30~50% 저렴.

---

## 10. 단계별 도입 로드맵 (Week-by-Week)

| Week | 도입 |
|---|---|
| 1 | GitHub repo, Cloudflare 계정, 도메인 등록 |
| 2 | Cloudflare Pages 연결, Next.js 스켈레톤 배포 |
| 3 | Supabase 프로젝트 생성, NextAuth + Google OAuth |
| 4 | Resend 도메인 인증, Brevo 백업 계정 |
| 5~6 | 핵심 도메인 모델 구축 (User/App/Match/Credit) |
| 7~8 | Cloudflare Cron Triggers로 14일 체크인 자동화 |
| 9 | 토스페이먼츠 연동 + Webhook |
| 10 | Sentry, PostHog 연동 |
| 11 | UptimeRobot 모니터링 등록, 백업 자동화 |
| 12 | Closed Beta 50명 → 부하 테스트 → 한도 모니터링 |

---

## 11. 결정 대기 항목 (Open Decisions)

- [x] ~~Vercel 사용 여부~~ — **2026-05-04 잠금**: Cloudflare Pages 채택 (상업 OK + bandwidth 무제한)
- [ ] Supabase Pro 전환 시점 — 첫 결제 발생 vs 동시 매칭 10건 도달 vs 1주 후 즉시
- [ ] Brevo 도입 시점 — 출시 직후 vs 일 80통 도달 시점
- [ ] Sentry 대신 BetterStack 도입 검토 (팀 무료 5명)
- [ ] Cloudflare Workers Paid $5/월 — 무료로 충분한지 v0.2 시점에 재검토

---

## 12. 출처 및 검증 (2026년 5월 기준)

- [Vercel Hobby Plan — 비상업적 사용 제한](https://vercel.com/docs/plans/hobby)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages 무료 플랜 (상업 OK)](https://www.cloudflare.com/plans/free/)
- [Supabase Pricing — Free Tier](https://supabase.com/pricing)
- [Supabase 자동 일시정지 정책](https://supabase.com/docs/guides/platform/going-into-prod)
- [Resend Pricing](https://resend.com/pricing)
- [Resend 계정 한도 — 100/일](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Brevo (Sendinblue) Pricing](https://www.brevo.com/pricing/)
- [PostHog Pricing](https://posthog.com/pricing)
- [Sentry Pricing](https://sentry.io/pricing/)
- [Inngest Pricing](https://www.inngest.com/pricing)
- [토스페이먼츠 수수료](https://docs.tosspayments.com/)
- [Stripe Pricing](https://stripe.com/pricing)
- [UptimeRobot Free](https://uptimerobot.com/pricing/)

---

## 13. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| v0.1 | 2026-05-04 | 무료 우선 스택 초안. Vercel/Supabase/Resend 함정 명시. |
