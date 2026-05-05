# 2026-05-05 — Cron 운영 위생 (F-CHK-06 + F-APP-02)

> 매칭 → 체크인 → 완주 루프의 그림자 부분(미체크인 매칭, 깨진 링크) 정리.

---

## 신규

| 파일 | 역할 |
|---|---|
| supabase/migrations/20260505000002_users_trigger_service_role_bypass.sql | users_protect_admin_fields 트리거를 INVOKER + service_role 우회로 수정 |
| lib/penalty.ts | `shouldPenalize()` 판정 로직 + `PENALTY_TRUST_DELTA` 상수 |
| lib/penalty.test.ts | 6 tests (경계값) |
| /api/cron/penalty-sweep/route.ts | F-CHK-06 — 미체크인 매칭 sweep |
| /api/cron/validate-app-urls/route.ts | F-APP-02 — 안드로이드/웹 링크 HEAD 검증 |
| wrangler.toml | cron 일정 2개 추가 |

---

## 동작

### F-CHK-06 페널티 sweep (`/api/cron/penalty-sweep`)

매일 KST 21:00 (일일 리마인더 1시간 후) 실행:

1. `matches.status = 'active'` 모두 조회 (+ 체크인 정보)
2. 각 매칭에 대해 `shouldPenalize()` 판정
   - 14일 경과인데 체크인 14 미만 → 페널티
   - 또는 마지막 체크인 후 5일 이상 미체크인 → 페널티
3. 부과:
   - `matches.status = 'penalized'` (동시성 가드: `eq('status', 'active')`)
   - `users.trust_score` -10 (clamp 0-100)
   - `trust_score_history` row 추가 (`reason='penalty.no_checkin'`)
   - `apps.required_testers + 1` (정원 복구)

### F-APP-02 링크 HEAD 검증 (`/api/cron/validate-app-urls`)

6시간 간격 실행:

1. 활성 상태(`matching/reviewing/launched`) 앱 중 24h 내 검증 안 된 50건 조회
2. 각 앱의 `store_invite_url` + `web_invite_url` 동시 HEAD (Promise.all)
3. 둘 다 200~399 면 `store_invite_url_validated_at = now()` 갱신
4. 한쪽이라도 실패면 콘솔 경고만 (앱 상태 변경 X)
   - Google Play 일시 점검 등 false negative 방지
   - 향후 N회 연속 실패 시 dev 알림 메일 추가 예정

---

## 트리거 수정 메모

기존 `users_protect_admin_fields` 는 `SECURITY DEFINER` 였음 → trigger 안에서
`current_user` 가 함수 owner(postgres)로 평가되어 검사 무의미.

수정:
- SECURITY 절 제거 (INVOKER 기본) → `current_user` = 세션 role
- `service_role / supabase_admin / postgres` 시스템 컨텍스트는 보호 우회
- admin role 사용자는 우회 (기존 동작)
- 일반 사용자는 role/trust_score/status 변경 시 silently 원복 (기존 동작)

이로 인해 cron(service_role)이 `users.trust_score` 를 안전하게 조정 가능.

---

## 검증

```bash
pnpm typecheck   # ✓
pnpm lint        # ✓
pnpm test        # ✓ 69/69 (penalty 6 tests 추가)
```

### 수동 테스트 (운영 환경)

```bash
# 페널티 sweep 트리거
curl https://testermatch.com/api/cron/penalty-sweep \
  -H "Authorization: Bearer $CRON_SECRET"

# URL 검증
curl https://testermatch.com/api/cron/validate-app-urls \
  -H "Authorization: Bearer $CRON_SECRET"
```

응답:
```json
{ "ok": true, "candidates": 5, "penalized": 1 }
{ "ok": true, "candidates": 12, "valid": 12, "invalid": 0, "issues": [] }
```

---

## 미완료 / 후속

- [ ] 페널티 부과 시 사용자에게 알림 메일 (현재 trust_score 만 차감)
- [ ] 링크 검증 N회 연속 실패 시 dev 알림 메일
- [ ] 페널티 받은 매칭에 대한 dev 알림 (보충 필요 안내)
- [ ] `web_invite_url_validated_at` 별도 컬럼 분리 검토
- [ ] cron 실행 결과 로그 영구 저장 (audit_logs 활용)
