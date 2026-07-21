# WORKLOG — 일일 작업 로그

> **용도**: "어제 뭐 했지 / 오늘 뭐 하지"의 단일 소스.
> **규칙**: 매 세션 종료 시 오늘 날짜 항목에 3줄 이내로 기록 (한 일 / 결정 / 내일). 최신이 위.
> 상세 기술 내용은 [04-review/history/](04-review/history/), 할일 전체는 [NEXT.md](NEXT.md).

---

## 2026-07-21 (월)

- **한 일**: 이중 그룹 아키텍처 배포 (Play용 `tester-match@googlegroups.com` + 가입 버튼 전 페이지), 자가확인 상태 폐기(오조작), 모바일 네비 프로필 추가. ADR-0009·DEPLOY.md·WORKLOG.md 문서화
- **결정**: consumer 그룹 = Play 자격, Workspace 그룹 = 내부 명단 (ADR-0009). 자동 가입 약속 문구 전면 제거
- **내일**: consumer 그룹 설정 최종 확인 → Play Console 등록 검증 → 실계정 E2E → 문의 회신 + 공지

## 2026-07-20 (일)

- **한 일**: 공지 시스템 (관리자 카테고리·상단 고정·플로팅 버튼·post_reads), 조회수 실집계 RPC, PGRST201 게시판 장애 복구 (FK 힌트)
- **결정**: post_reads는 범용 조인 테이블로 설계 (라벨 확장 가능)
- **교훈**: 조인 테이블 추가 시 대상 테이블 임베드 전수 점검

## 2026-07-19 (토)

- **한 일**: 관리자 표시 (댓글 배지·게시판 칩·알림 강조), 레거시 앱 그룹 전환 배너, 전환 유도 일괄 알림
- **이슈**: Workspace 그룹 Play Console 3일째 미인식 → 플랜 B(중첩) 시도 예정

## 2026-07-18 (금)

- **한 일**: 공용 그룹 전면 적용 (앱 폼 고정, 실시간 멤버십 확인, 관리자 명단), Directory API 자동 가입 (edge JWT 서명)
- **이슈**: Play Console이 testers@knockknock.company 거부 시작

## 2026-07-17 (목)

- **한 일**: 사업자 등록 후 자동화 — Play Store URL 파서 자동 채움, 온보딩 카드, KPI 대시보드
- **인프라**: knockknock.company 도메인 확보, GoDaddy NS → Cloudflare, Cloud Identity Free 전환, tester01~20 계정 생성 시작

## 2026-07-16 (수)

- **한 일**: AdSense 심사 신청 (로더+ads.txt 유지), 광고 배치 3커밋 `feat/adsense-placements` 보존 후 main 리버트
- **결정**: 보상형 광고 미구현 (AdSense 웹 미지원 + 정책 리스크)

## 2026-07-15 (화)

- **한 일**: 급구 무료 오픈 (7일 자동 만료 + 랜덤 셔플 상단 고정), 카톡 오픈채팅 공유 3단계 모달 (MODOS 스타일)

---

<details>
<summary>2026-05 ~ 07-14 (요약)</summary>

- 07-14: 등록 후 자동화 설계 (ADR-0008)
- 05-16: 알림 시스템
- 05-15: 테스터 요청 기능
- 05-05: 매칭 엔진 v1, 크레딧, 14일 체크인, 게시판, 관리자 도구, 맞리뷰 (Week 3~5 몰아치기)
- 05-04: 스캐폴드, 인증, RLS, 앱 등록 (Week 2)

상세: [04-review/history/](04-review/history/) 날짜별 파일
</details>
