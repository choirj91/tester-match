# 2026-07-21 — 이중 그룹 아키텍처 전환 세션

## 배경

`testers@knockknock.company`(Workspace) Play Console 등록이 3일간 실패. 중첩 그룹 우회도 실패("그룹은 다른 그룹에 추가될 수 없습니다"). 결정: consumer 그룹으로 Play 자격 분리 → [ADR-0009](../../01-source/decisions/ADR-0009-dual-group-architecture.md).

## 배포된 변경 (commits 3bfeeff → 80e5ab8)

1. **상수 분리** — `tester-group.ts`에 `PLAY_GROUP_EMAIL`(tester-match@googlegroups.com) / `PLAY_GROUP_URL` / `PLAY_GROUP_JOIN_URL` 추가
2. **마이그레이션** `20260722000001_play_group_joined.sql` — `users.play_group_joined_at` (자가확인용으로 추가했으나 아래 4번에서 UI 폐기, 컬럼은 무해하게 잔존)
3. **가입 접점 전면 배치** — `PlayGroupJoinPrompt` 컴포넌트:
   - 브라우즈 상세 (공용 그룹 앱: 필수 안내 / 그룹 없는 레거시 앱: "추천" 소프트 안내)
   - 앱 등록 페이지 (개발자도 품앗이 테스터)
   - 내 테스트 (앱 카드별)
   - 프로필 (메인 카드)
4. **자가확인 상태 폐기** (80e5ab8) — "가입 완료했어요" 버튼 오조작 문제 → 가입 링크 상시 노출로 단순화. membership API의 `{play: bool}` POST 제거
5. **개발자 문구 전환** — Play Console 등록 이메일 전부 `PLAY_GROUP_EMAIL`로 (앱 등록 폼·수정 폼·앱 상세·업그레이드 배너·카톡 공유), 이메일 복사 버튼 추가
6. **거짓 문구 제거** — "로그인만 하면 자동 가입" 전면 삭제
7. **모바일 네비에 프로필 추가** — 모바일에서 프로필 진입로 부재 해소

## 교훈

- Play Console은 커스텀 도메인 그룹 사실상 미지원 — 공개 설정 완벽해도 안 됨. consumer 그룹만 신뢰
- consumer 그룹: API 없음(자동 추가 불가), 그룹 중첩 불가
- 자가신고 상태는 오조작 리스크 — 검증 불가능한 상태는 아예 안 만드는 게 낫다
- `&& npx tsc | head` 파이프는 exit code 삼킴 → 잘못된 cwd에서 빌드 실패해도 이전 빌드가 배포됨 (DEPLOY.md 사고 이력 기록)

## 후속 (사용자 액션)

- consumer 그룹 공개 설정 최종 확인 + Play Console 등록 검증 + 실계정 E2E
- 검증 후 문의 개발자 회신 + 공지 게시
