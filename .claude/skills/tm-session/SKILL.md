---
name: tm-session
description: Tester Match 세션 사이클 — 시작 시 컨텍스트 회복, 종료 시 WORKLOG/NEXT 자동 갱신. "어디까지 했지", "오늘 뭐 하지", "작업 정리해줘", 세션 마무리 요청 시 사용.
---

# Tester Match 세션 사이클

## 세션 시작 — 컨텍스트 회복 (읽는 순서)

1. [WORKLOG.md](../../../WORKLOG.md) 최근 3일 — 어제 한 일 + "내일" 줄이 오늘 할 일
2. [NEXT.md](../../../NEXT.md) — 🔥 즉시 섹션 = 우선순위
3. `git log --oneline -10` — 문서와 코드 싱크 확인
4. 깊은 컨텍스트 필요 시: [04-review/history/](../../../04-review/history/) 최근 파일, [01-source/decisions/](../../../01-source/decisions/) ADR

사용자가 "어디까지 했지" 물으면 위 1~3 요약해서 답하고, 오늘 후보 작업을 NEXT.md 즉시 섹션에서 뽑아 제시.

## 세션 종료 — 문서 갱신 (배포 후 또는 마무리 요청 시)

1. **WORKLOG.md**: 오늘 날짜 항목 최상단 추가/갱신 — 3줄 형식:
   ```
   ## YYYY-MM-DD (요일)
   - **한 일**: (1줄, 커밋 기준)
   - **결정**: (있을 때만)
   - **내일**: (다음 액션 1줄)
   ```
2. **NEXT.md**: 완료 항목 체크/이동, 새 할일 추가, "최근 완료" 표에 오늘 줄 추가, 마지막 업데이트 날짜 갱신
3. **큰 결정·장애·아키텍처 변경 시에만**: `04-review/history/YYYY-MM-DD-<slug>.md` 세션 기록 생성 (배경/변경/교훈/후속)
4. **잠금 결정 충돌·새 아키텍처 결정 시**: ADR 추가 (`01-source/decisions/ADR-NNNN-*.md`, 번호 이어서). 코드보다 ADR 먼저.

## 프로젝트 불변 규칙 (요약 — 전문은 CLAUDE.md)

- `01-source/` 수정 금지 (ADR **추가**는 허용)
- 잠금: 한국 우선(KRW/KST) · Cloudflare Pages+Supabase · 1원=1크레딧, 1매칭=1,000원(800/200)
- 결제·정책·약관 변경 = 사용자 승인 필수. 환불 코드 멱등성. 14일 카운트 timezone-safe 테스트
- Google Play 리뷰 인센티브 기능(F-RVW-*) 활성화 금지

## 도메인 지식 앵커 (자주 쓰는 사실)

- 그룹 아키텍처: [ADR-0009](../../../01-source/decisions/ADR-0009-dual-group-architecture.md) — Play=consumer 그룹(1클릭 가입, API 없음), 내부=Workspace(자동)
- 그룹 상수 단일 소스: `03-output/app/src/lib/tester-group.ts`
- posts 임베드는 FK 힌트 필수 (`users_public_profile!posts_author_user_id_fkey!inner`) — post_reads 때문
- admin role 변경 SQL은 `users_protect_admin_fields_trg` 트리거 disable/enable 필요
- 광고 배치 코드는 `feat/adsense-placements` 브랜치에만 존재

## 배포

배포는 **tm-deploy 스킬** 절차 따름. 임의 원커맨드 파이프 금지.
