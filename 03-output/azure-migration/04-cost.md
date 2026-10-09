# 04 — 비용 모델

- 갱신: 2026-10-04 — 방침 변경: **무료 한도 목표 폐기, 최소 유료 사양 + 확장 가능** (ADR-0015)
- 단가: Azure Retail Prices API (https://prices.azure.com/api/retail/prices), Korea Central, USD, 월 730시간, 확인일 2026-10-04. 환율 1 USD ≈ 1,400원 [추정]. 부가세 별도.
- 크레딧: Microsoft for Startups 스폰서십, $5,000 이하 (사용자 답변). 소진·만료 후 자동 종량제 [문서: https://learn.microsoft.com/en-us/startups/microsoft-for-startups/mfs-faqs]

## 1. 시작 구성 (전 단계 완료 후)

| 항목 | 사양 | 월 |
|---|---|---|
| App Service Plan Linux | B1 (1 vCPU·1.75 GB), 1 인스턴스 | $13.1 |
| PostgreSQL Flexible | Burstable B1ms (1 vCore·2 GiB) | $19.0 |
| └ 스토리지 | Premium SSD 32 GB ($0.131/GB) | $4.2 |
| └ 백업 | 7일 보존 (프로비저닝 용량까지 무료) | $0 |
| Functions Flex Consumption | 타이머 8개, 무료 할당 이내 (2026-10-09 주간 리포트 추가: 주 1회 실행·메일 1통 — 증가 ~$0) | ~$0 |
| Blob Storage | Hot LRS, 스크린샷 수 GB | ~$0.1 |
| ACS Email | 월 수천 통 ($0.00025/통 + $0.00012/MB) | ~$1 |
| Azure DNS | 공개 영역 1개 $0.5 + 질의 $0.4/백만 | ~$1 |
| Application Insights / Log Analytics | 월 5 GB 무료, 초과 $3.11/GB | $0~5 |
| Key Vault | Standard, 작업당 과금 | ~$0.1 |
| **합계** | | **약 $40~45 (≈6만원)** |

이전 기간에는 Azure 와 Cloudflare·Supabase 가 병행되고, 2단계 리허설 동안 스테이징 PostgreSQL(B1ms, ~$23) 이 일시 추가된다.

## 2. 확장할 때 (코드 변경 없음, SKU 만)

| 신호 | 조치 | 월 증가 |
|---|---|---|
| App Service CPU 70%↑ 지속·응답 p95 악화 | B1 → B2 | +$13 |
| 배포 슬롯·자동 확장 필요 | → P0v3 (단가는 계산기로 재확인) | +$40~60 [추정] |
| 인스턴스 다중화 | B1 인스턴스 1 → 2~3 | +$13/대 |
| DB CPU 크레딧 소진·느린 쿼리 | B1ms → B2s | 계산기 재확인 (API 값 $75.9 는 이례적) |
| DB 상시 부하·HA 필요 | 범용 2 vCore ($0.246/h) + 영역 중복 HA | +$180 / HA 시 +$360 |
| WAF·CDN·봇 차단 필요 | Front Door Standard | +$35 + 전송량 |

## 3. 예산 알림

| 예산 | 현재 | 권고 |
|---|---|---|
| `budget-testermatch-monthly` | **$100** (2026-10-04 사용자 승인으로 $20 → $100) | 시작 구성 $45 + 병행·리허설·확장 여유. 알림 50%·100% 실제, 100% 예측 → admin@ |
| 사양 변경 시 | — | 2절 증가분만큼 같이 올린다 |

- 예산은 지출을 막지 않고 알림만 보낸다 [추정 — 문서 재확인].
- 크레딧 잔액은 포털 Credits 화면에서 월 1회 확인 (홈페이지와 같은 구독을 공유하므로 둘의 합으로 소진됨).
- 크레딧 만료 30일 전: 월 약 $45 청구 시작을 다시 확인.
