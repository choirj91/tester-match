# 2026-10-04 — `public.apps` 중복 행 조사·1단계 정리

> 방법: 운영 DB 읽기 전용 전수 조회(GET 만, 1,000행 페이지네이션) → 로컬 집계 → 사용자 승인 → 드라이런 → 반영.
> 시각은 UTC. 표기: ✅ 완료 · 👤 승인 필요 · ⏳ 후속. §1~§8 의 수치는 조사 시점(살아있는 앱 1,169행) 기준.

## 0. 결과 ✅

사용자 승인(계획대로 · 동률은 최신 제출 유지) 후 2026-10-04 운영 반영. 반영 직전 재조회에서 84쌍이 그대로임을 확인(그 사이 신규 등록 5건·소유자 삭제 1건, 새 중복 없음).

| 항목 | 드라이런 | 반영 후 검증 |
|---|---|---|
| 소프트 삭제 | 84 | 84행 모두 `deleted`, 유지 행 모두 살아있음 |
| 매칭 · 댓글 · 홍보 참조 교체 | 17 · 10 · 7 | 삭제 행에 남은 참조 0 |
| 알림 삭제 / 링크 교체 | 73 / 2 | group_upgrade 675 → 606, 같은 링크 반복 0 |
| 살아있는 앱 | 1,089 | 1,089 (1,173 − 84) |
| 엄격 중복 그룹 | — | 0 |

남은 일: 2단계 수동 검토(느슨한 21그룹 · 타 소유자 13그룹), 3단계 unique 인덱스·일반 등록 라우트 가드(§7).

## 1. 범위

| 항목 | 값 |
|---|---|
| 전체 앱 행 | 1,246 (deleted 77 / 살아있는 행 1,169 = matching 1,161 · launched 5 · reviewing 2 · paused 1) |
| **엄격 중복** (같은 소유자 + 이름 + 스토어 링크 완전 일치, deleted 제외) | **80그룹 · 164행 · 잉여 84행** (2행 76그룹, 3행 4그룹) |
| 중복 행 상태 | 164행 전부 `matching` |
| 관련 소유자 | 75명 |
| 느슨한 중복 (같은 소유자 + 이름 정규화 또는 패키지명 또는 링크 일치) | 98그룹 · 212행 · 잉여 114행 — 이 중 21그룹은 엄격 일치 쌍 없음 → 수동 검토 대상 |
| 다른 소유자가 같은 패키지 등록 | 13그룹 · 29행 — 이번 정리 범위 밖 |

### 생성 시점

| 출처 | 그룹 | 행 | 잉여 |
|---|---|---|---|
| 2026-05-05 일괄 import (14:09~14:11 UTC = 23:09~23:11 KST, 640행·소유자 524명) | 65 | 132 | 67 |
| 그 이후 일반 등록 (`POST /api/apps`, 05-22 ~ 09-22) | 15 | 32 | 17 |

그룹 내 첫 행~마지막 행 간격: 2초 이내 29 · 60초 이내 36 · 1시간 이내 5 · 1일 이내 5 · 1일 초과 5.

## 2. 원인

1. **import 원본에 같은 행이 반복** — 05-05 그룹 65개의 두 갈래:
   - 34그룹: 연속 35행 블록(id 1108~1142)이 바로 뒤에 통째로 한 번 더 들어감(id 1143~1177, 간격 정확히 35). 원본 JSON 에 같은 구간이 두 번 붙여넣어진 것.
   - 31그룹: id 차이 1~11 의 근접 행(1개만 329). 같은 사람이 양식을 다시 제출한 것 — 전체 80그룹 중 설명 29그룹·모집 인원 18그룹이 행마다 달라 "수정해서 다시 제출"한 흔적.
2. **import 라우트에 기존 행 확인 없음** — `apps` 에 unique 인덱스도 없어 그대로 INSERT.
3. **일반 등록 라우트(`POST /api/apps`)도 동일** — 15그룹이 여기서 발생. 2~7분 간격 재제출(1367/1368, 1663/1664, 1918/1919)과 며칠 뒤 재등록이 섞여 있음.

## 3. 잉여 행이 물고 있는 참조

중복 164행 전체 기준:

| 테이블 | 건수 | 비고 |
|---|---|---|
| matches | 73 | 진행 중(active) 3건 — 1489·1498·1919 |
| checkins (matches 경유) | 133 | |
| notifications (`/apps/<id>` 링크) | 149 | group_upgrade 136 · boost_expired 9 · boost_expiring 4 |
| app_comments.app_id | 45 | |
| app_comments.promoted_app_id | 27 | 다른 앱 댓글에서 홍보 링크로 사용 |
| paid_tester_orders · tester_request_sends · boost_orders · payments.ref_app_id | 0 | |

활동 분포: 64그룹은 어느 행에도 활동 없음 · 7그룹은 한 행에만 · 9그룹은 두 행에 나뉘어 있음.

## 4. 영향

- **둘러보기**: 노출 1,161행 중 84행(7.2%)이 같은 앱의 반복. 느슨한 기준이면 114행(9.8%).
- **통계**: `/stats`·`/admin/stats` 의 등록 앱 수 1,169 → 실제 1,085 (84 과대). 소유자별 앱 수도 75명이 부풀려짐.
- **알림**: 07-19 group_upgrade 675건 중 69건이 같은 소유자에게 반복 발송 (63명, 67그룹). boost 만료 알림도 4건 반복. 앱 행 단위로 도는 발송·크론은 정리 전까지 계속 반복됨.
- **매칭 분산**: 9그룹에서 테스터가 두 행에 나뉘어 참여 (예: 소유자 790 — 18건 vs 2건).

## 5. 재발 방지 ✅ (브랜치 `claude/suspicious-cannon-f4844e`)

- `lib/app-dedupe.ts` — `appDedupeKey`: 이름(대소문자·공백·한글 자모 분리 무시) + 스토어 링크.
- import 라우트 — 소유자별 살아있는 앱 키를 한 번 조회하고, 일치하면 INSERT 하지 않고 `duplicates` 로 반환. 같은 요청 안의 반복 행도 차단. 조회 실패 시 해당 행은 넣지 않음.
- import 폼 — "중복 건너뜀" 수치·목록 표시, 묶음 간 행 번호 보정.
- 테스트: 라우트·키·폼 병합. 수정 전 라우트 테스트 6건 실패 확인 후 통과. tsc·eslint 통과.

남은 구멍 ⏳: 동시 요청 두 개는 여전히 통과 → 정리 후 부분 unique 인덱스로 막아야 함(§7 3단계). 일반 등록 라우트는 미수정. 폼의 행 번호는 검증 통과 행 기준이라 검증 실패 행이 앞에 있으면 붙여넣은 원본 번호와 어긋남(기존 `errors` 와 같은 동작).

## 6. 유지 행 선정 규칙

우선순위: ① 진행 중 매칭이 있는 행(3그룹) → ② 활동(매칭+체크인+댓글+홍보 참조) 최다(13) → ③ 소유자 수정 이력(1) → ④ 기본 문구가 아닌 설명(3) → ⑤ 최신 제출(60 — 모집 인원이 100→12, 0→15 처럼 뒤 행에서 고쳐진 사례 기준).

삭제 대상 84행이 가진 참조: 매칭 17(penalized 16 · opted_out 1, **진행 중 0**) · 체크인 20 · 댓글 10 · 홍보 참조 7 · 알림 75. 필드 이관이 필요한 행 없음(급구·웹 링크·그룹 링크는 유지 행이 이미 보유).

## 7. 정리 계획 (1단계 ✅ 반영 · 2~3단계 👤)

**1단계 — 엄격 중복 84행 (아래 표)**

| 대상 | 처리 | 건수 |
|---|---|---|
| notifications | 유지 행에 같은 (user, type) 알림이 있으면 삭제, 없으면 링크를 유지 행으로 교체 | 삭제 73 · 교체 2 |
| app_comments.promoted_app_id | 유지 행으로 교체 (안 하면 홍보 링크가 404) | 7 |
| app_comments.app_id | 유지 행으로 교체 (댓글 스레드 합침) | 10 |
| matches.app_id | 유지 행으로 교체. 체크인은 match_id 를 따라가므로 변경 없음 | 17 (체크인 20) |
| apps.status | `deleted` 로 소프트 삭제 | 84 |

- **하드 삭제는 하지 않음** — `matches`·`app_comments` 가 `on delete cascade` 라 페널티 16건의 근거와 체크인 20건이 같이 사라짐. 신뢰도 이력·원장은 match id 를 가리키므로 고아가 됨.
- matches·notifications 에는 트리거 없음. 신뢰도·크레딧은 match id 기준이라 app_id 교체로 변하지 않음. 같은 테스터가 두 행 모두에 매칭을 가진 경우 2건(둘 다 penalized) — 부분 unique 인덱스는 pending/active 만 대상이라 충돌 없음.
- 되돌리기: 매핑·변경 전 값·삭제 대상 알림 원본을 보관 테이블에 남김 (§9).
- 소유자 "내 앱" 목록은 deleted 행을 걸러내지 않아 삭제된 행이 계속 보임 — 기존 동작. 별도 수정 필요.

**2단계 — 수동 검토**: 엄격 일치가 없는 느슨한 21그룹(이름만 다른 같은 패키지 등), 다른 소유자 13그룹. 이름이 다르면 다른 앱일 수 있어(예: 소유자 234 는 패키지가 다름) 자동 처리 금지.

**3단계 — 재발 차단**: 1단계 후 `(owner_user_id, lower(btrim(name)), coalesce(btrim(store_invite_url), ''))` 부분 unique 인덱스(`status <> 'deleted'`) + 일반 등록 라우트에서 23505 를 "이미 등록된 앱" 안내로 처리. 며칠 뒤 같은 앱을 다시 올리는 사용 패턴(5그룹)을 막게 되므로 정책 결정 필요.

## 8. 그룹별 유지/삭제

굵은 id = 유지. 괄호 = 그 행의 활동.

| # | 소유자 | 앱 이름 | 첫 생성 | 유지 | 삭제 | 근거 |
|---|---|---|---|---|---|---|
| 1 | 49 | LegalMind | 2026-05-05 | **754** | 753 | 활동 없음→최신 제출 |
| 2 | 76 | 버짓버디 | 2026-05-05 | **784** | 1113, 1148 | 소유자 수정 이력 |
| 3 | 85 | 여행친구(푸른전설) | 2026-05-05 | **793 (매칭 1/체크인 3/댓글 0/홍보 0)** | 797 (매칭 1/체크인 0/댓글 0/홍보 0) | 활동 최다 |
| 4 | 91 | 해양오염예방동반자 | 2026-05-05 | **800 (매칭 4/체크인 2/댓글 1/홍보 0)** | 802 (매칭 2/체크인 1/댓글 0/홍보 0) | 활동 최다 |
| 5 | 156 | COPOT | 2026-05-05 | **861** | 860 | 활동 없음→최신 제출 |
| 6 | 166 | 할인의왕 | 2026-05-05 | **875** | 873 | 활동 없음→최신 제출 |
| 7 | 194 | FreeCal | 2026-05-05 | **904** | 903 | 활동 없음→최신 제출 |
| 8 | 290 | 달콩가노 | 2026-05-05 | **1010** | 999 | 활동 없음→최신 제출 |
| 9 | 291 | Switch | 2026-05-05 | **1000** | 1004 | 설명 입력됨 |
| 10 | 301 | DIY 문제집 | 2026-05-05 | **1013** | 1012 | 활동 없음→최신 제출 |
| 11 | 311 | jinsungman | 2026-05-05 | **1025** | 1024 | 활동 없음→최신 제출 |
| 12 | 318 | 원픽타로 | 2026-05-05 | **1033** | 1032 | 활동 없음→최신 제출 |
| 13 | 338 | 주군 | 2026-05-05 | **1058** | 1057 | 설명 입력됨 |
| 14 | 393 | DailyPodium | 2026-05-05 | **1143** | 1108 | 활동 없음→최신 제출 |
| 15 | 393 | MyArkiv | 2026-05-05 | **1144** | 1109 | 활동 없음→최신 제출 |
| 16 | 394 | 한입 택택토 | 2026-05-05 | **1145** | 1110 | 활동 없음→최신 제출 |
| 17 | 395 | 여기 | 2026-05-05 | **1146** | 1111 | 활동 없음→최신 제출 |
| 18 | 396 | Voicetale | 2026-05-05 | **1147** | 1112 | 활동 없음→최신 제출 |
| 19 | 397 | 파일룸 | 2026-05-05 | **1149** | 1114 | 활동 없음→최신 제출 |
| 20 | 398 | 파일룸 | 2026-05-05 | **1150** | 1115 | 활동 없음→최신 제출 |
| 21 | 399 | 주팡 | 2026-05-05 | **1151** | 1116 | 활동 없음→최신 제출 |
| 22 | 400 | 머지당구 | 2026-05-05 | **1152** | 1117 | 활동 없음→최신 제출 |
| 23 | 401 | 그래 해봐 | 2026-05-05 | **1153** | 1118 | 활동 없음→최신 제출 |
| 24 | 402 | Integri-Scan | 2026-05-05 | **1154** | 1119 | 활동 없음→최신 제출 |
| 25 | 403 | 무음 스케줄러 | 2026-05-05 | **1155** | 1120 | 활동 없음→최신 제출 |
| 26 | 404 | KeyVault | 2026-05-05 | **1156** | 1121 | 활동 없음→최신 제출 |
| 27 | 405 | 몽환 타로 | 2026-05-05 | **1157** | 1122 | 활동 없음→최신 제출 |
| 28 | 406 | 아르르르 | 2026-05-05 | **1158** | 1123 | 활동 없음→최신 제출 |
| 29 | 407 | 퐁실타로 | 2026-05-05 | **1159** | 1124 | 활동 없음→최신 제출 |
| 30 | 408 | AI Me | 2026-05-05 | **1160** | 1125 | 활동 없음→최신 제출 |
| 31 | 406 | 거꾸로레시피 | 2026-05-05 | **1161** | 1126 | 활동 없음→최신 제출 |
| 32 | 409 | AI 로또 번호 생성기 | 2026-05-05 | **1162** | 1127 | 활동 없음→최신 제출 |
| 33 | 410 | 고(GO!)해 | 2026-05-05 | **1163** | 1128 | 활동 없음→최신 제출 |
| 34 | 411 | 디로그 | 2026-05-05 | **1164** | 1129 | 활동 없음→최신 제출 |
| 35 | 412 | MY_CSE | 2026-05-05 | **1165** | 1130 | 활동 없음→최신 제출 |
| 36 | 413 | tino | 2026-05-05 | **1166** | 1131 | 활동 없음→최신 제출 |
| 37 | 414 | 노답노트 | 2026-05-05 | **1167** | 1132 | 활동 없음→최신 제출 |
| 38 | 415 | Vocaquest | 2026-05-05 | **1168** | 1133 | 활동 없음→최신 제출 |
| 39 | 416 | our moment | 2026-05-05 | **1169** | 1134 | 활동 없음→최신 제출 |
| 40 | 417 | 쫀득쫀득 | 2026-05-05 | **1170** | 1135 | 활동 없음→최신 제출 |
| 41 | 418 | ClearNest ­ 중복 사진 정리 | 2026-05-05 | **1171** | 1136 | 활동 없음→최신 제출 |
| 42 | 418 | GonWorks | 2026-05-05 | **1172** | 1137 | 활동 없음→최신 제출 |
| 43 | 419 | 오늘도확인 | 2026-05-05 | **1173** | 1138 | 활동 없음→최신 제출 |
| 44 | 420 | 형님 타로 | 2026-05-05 | **1174** | 1139 | 활동 없음→최신 제출 |
| 45 | 421 | underdragon | 2026-05-05 | **1175** | 1140 | 활동 없음→최신 제출 |
| 46 | 422 | 니혼고 | 2026-05-05 | **1176** | 1141 | 활동 없음→최신 제출 |
| 47 | 390 | Easy Score | 2026-05-05 | **1177** | 1142 | 활동 없음→최신 제출 |
| 48 | 438 | 태미만세력 | 2026-05-05 | **1193** | 1192 | 활동 없음→최신 제출 |
| 49 | 448 | 견적쏙 | 2026-05-05 | **1203** | 1202 | 활동 없음→최신 제출 |
| 50 | 452 | 에덴 성경책(PE2S) | 2026-05-05 | **1208** | 1207 | 활동 없음→최신 제출 |
| 51 | 461 | 음력달그림자 | 2026-05-05 | **1219** | 1217 | 활동 없음→최신 제출 |
| 52 | 484 | BusLink | 2026-05-05 | **1252** | 1242 | 활동 없음→최신 제출 |
| 53 | 491 | Simple Bible Verses | 2026-05-05 | **1251** | 1250 | 활동 없음→최신 제출 |
| 54 | 506 | LEVEL UP: REBOOT | 2026-05-05 | **1270** | 1268 | 활동 없음→최신 제출 |
| 55 | 518 | 어린이 탐정단 | 2026-05-05 | **1321** | 1280, 1286 | 활동 없음→최신 제출 |
| 56 | 532 | 데일리주식 | 2026-05-05 | **1297** | 1296 | 활동 없음→최신 제출 |
| 57 | 533 | 아이북랜드 | 2026-05-05 | **1387 (매칭 1/체크인 0/댓글 0/홍보 0)** | 1298 | 활동 최다 |
| 58 | 539 | 헤이영쑤! | 2026-05-05 | **1306** | 1305 | 활동 없음→최신 제출 |
| 59 | 541 | Jeon:log | 2026-05-05 | **1310** | 1308 | 활동 없음→최신 제출 |
| 60 | 547 | Bio Insider | 2026-05-05 | **1317** | 1315 | 설명 입력됨 |
| 61 | 553 | 딸깍, 결혼비용 계산기 | 2026-05-05 | **1329** | 1323 | 활동 없음→최신 제출 |
| 62 | 554 | 토스스 | 2026-05-05 | **1330** | 1324 | 활동 없음→최신 제출 |
| 63 | 555 | 중국어끝판와HSK완전정복 | 2026-05-05 | **1331** | 1325 | 활동 없음→최신 제출 |
| 64 | 555 | 중국어끝판왕 HSK완전정복 | 2026-05-05 | **1332** | 1326 | 활동 없음→최신 제출 |
| 65 | 556 | MagicFridge | 2026-05-05 | **1333** | 1327 | 활동 없음→최신 제출 |
| 66 | 557 | GoalStep | 2026-05-05 | **1334 (매칭 1/체크인 1/댓글 0/홍보 0)** | 1328 | 활동 최다 |
| 67 | 609 | AptEvService | 2026-05-22 | **1368** | 1367 | 활동 없음→최신 제출 |
| 68 | 778 | 몸회수 | 2026-06-23 | **1489 (매칭 11·진행 1/체크인 29/댓글 6/홍보 6)** | 1488 (매칭 3/체크인 0/댓글 2/홍보 2) | 진행 중 매칭 |
| 69 | 790 | Merge Defense | 2026-06-24 | **1498 (매칭 18·진행 1/체크인 24/댓글 12/홍보 0)** | 1506 (매칭 2/체크인 1/댓글 2/홍보 0) | 진행 중 매칭 |
| 70 | 889 | SFO ARINC HF Memo | 2026-07-12 | **1557 (매칭 4/체크인 1/댓글 3/홍보 6)** | 1560 (매칭 1/체크인 0/댓글 1/홍보 4) | 활동 최다 |
| 71 | 931 | 째깍 | 2026-07-18 | **1595 (매칭 3/체크인 8/댓글 3/홍보 0)** | 1594 (매칭 1/체크인 9/댓글 0/홍보 0) | 활동 최다 |
| 72 | 953 | 키워드파인더 | 2026-07-22 | **1616 (매칭 1/체크인 2/댓글 1/홍보 0)** | 1615, 1892 (매칭 1/체크인 0/댓글 1/홍보 1) | 활동 최다 |
| 73 | 955 | SlingPenguin | 2026-07-22 | **1628** | 1618, 1620 | 활동 없음→최신 제출 |
| 74 | 979 | 교대근무AZ | 2026-07-26 | **1637 (매칭 3/체크인 10/댓글 1/홍보 0)** | 1636 | 활동 최다 |
| 75 | 1007 | WakeAndGo | 2026-08-01 | **1664 (매칭 1/체크인 13/댓글 1/홍보 0)** | 1663 | 활동 최다 |
| 76 | 953 | 튜브파인더 | 2026-08-05 | **1695 (매칭 2/체크인 10/댓글 2/홍보 0)** | 1685 (매칭 4/체크인 5/댓글 3/홍보 0) | 활동 최다 |
| 77 | 1068 | 류현상 키우기 | 2026-08-12 | **1720 (매칭 3/체크인 2/댓글 2/홍보 3)** | 1724 (매칭 2/체크인 4/댓글 1/홍보 0) | 활동 최다 |
| 78 | 1127 | 디펜스크래프트 | 2026-08-25 | **1783 (매칭 1/체크인 0/댓글 0/홍보 0)** | 1781 | 활동 최다 |
| 79 | 1170 | 냉장고 관리 시스템 | 2026-09-03 | **1830 (매칭 0/체크인 0/댓글 0/홍보 5)** | 1822 | 활동 최다 |
| 80 | 499 | 피싱스팟다이어리 | 2026-09-22 | **1919 (매칭 2·진행 1/체크인 8/댓글 3/홍보 0)** | 1918 | 진행 중 매칭 |

## 9. 실행한 SQL (2026-10-04 운영 반영)

DO 블록 하나 = 트랜잭션 하나. `dry_run := true` 로 먼저 실행해 전부 롤백된 상태에서 건수를 확인한 뒤, 같은 SQL 을 `false` 로 반영. 검토한 건수와 하나라도 다르면 스스로 중단한다.

```sql
-- Duplicate-apps cleanup, stage 1 (approved 2026-10-04).
-- One DO statement = one transaction. With dry_run the final RAISE rolls everything back
-- and returns the counts in the error message.
do $$
declare
  dry_run constant boolean := false;
  n_map int; n_notif_backup int; n_refs int;
  n_notif_del int; n_notif_apps int; n_notif_browse int;
  n_promo int; n_comment int; n_match int; n_apps int; n_live int;
  counts jsonb;
begin
  create table public._app_dedupe_20261004 (
    remove_id   bigint primary key references public.apps(id),
    keep_id     bigint not null references public.apps(id),
    prev_status text
  );
  alter table public._app_dedupe_20261004 enable row level security;

  insert into public._app_dedupe_20261004 (remove_id, keep_id) values
    (753, 754),
    (1113, 784),
    (1148, 784),
    (797, 793),
    (802, 800),
    (860, 861),
    (873, 875),
    (903, 904),
    (999, 1010),
    (1004, 1000),
    (1012, 1013),
    (1024, 1025),
    (1032, 1033),
    (1057, 1058),
    (1108, 1143),
    (1109, 1144),
    (1110, 1145),
    (1111, 1146),
    (1112, 1147),
    (1114, 1149),
    (1115, 1150),
    (1116, 1151),
    (1117, 1152),
    (1118, 1153),
    (1119, 1154),
    (1120, 1155),
    (1121, 1156),
    (1122, 1157),
    (1123, 1158),
    (1124, 1159),
    (1125, 1160),
    (1126, 1161),
    (1127, 1162),
    (1128, 1163),
    (1129, 1164),
    (1130, 1165),
    (1131, 1166),
    (1132, 1167),
    (1133, 1168),
    (1134, 1169),
    (1135, 1170),
    (1136, 1171),
    (1137, 1172),
    (1138, 1173),
    (1139, 1174),
    (1140, 1175),
    (1141, 1176),
    (1142, 1177),
    (1192, 1193),
    (1202, 1203),
    (1207, 1208),
    (1217, 1219),
    (1242, 1252),
    (1250, 1251),
    (1268, 1270),
    (1280, 1321),
    (1286, 1321),
    (1296, 1297),
    (1298, 1387),
    (1305, 1306),
    (1308, 1310),
    (1315, 1317),
    (1323, 1329),
    (1324, 1330),
    (1325, 1331),
    (1326, 1332),
    (1327, 1333),
    (1328, 1334),
    (1367, 1368),
    (1488, 1489),
    (1506, 1498),
    (1560, 1557),
    (1594, 1595),
    (1615, 1616),
    (1892, 1616),
    (1618, 1628),
    (1620, 1628),
    (1636, 1637),
    (1663, 1664),
    (1685, 1695),
    (1724, 1720),
    (1781, 1783),
    (1822, 1830),
    (1918, 1919);
  get diagnostics n_map = row_count;

  update public._app_dedupe_20261004 d set prev_status = a.status
    from public.apps a where a.id = d.remove_id;

  -- Guards: every pair must still be the same live app of the same owner, and the rows
  -- to remove must carry no in-progress match and no paid order.
  if exists (
    select 1
      from public._app_dedupe_20261004 d
      join public.apps r on r.id = d.remove_id
      join public.apps k on k.id = d.keep_id
     where r.status = 'deleted' or k.status = 'deleted'
        or r.owner_user_id <> k.owner_user_id
        or r.name <> k.name
        or r.store_invite_url is distinct from k.store_invite_url
  ) then
    raise exception 'GUARD: a pair is no longer an identical live duplicate';
  end if;
  if exists (select 1 from public._app_dedupe_20261004 a join public._app_dedupe_20261004 b on a.keep_id = b.remove_id) then
    raise exception 'GUARD: a keep row is also listed for removal';
  end if;
  if exists (
    select 1 from public.matches m join public._app_dedupe_20261004 d on d.remove_id = m.app_id
     where m.status in ('pending', 'active')
  ) then
    raise exception 'GUARD: in-progress match on a row to remove';
  end if;
  if exists (select 1 from public.paid_tester_orders o join public._app_dedupe_20261004 d on d.remove_id = o.app_id) then
    raise exception 'GUARD: paid order on a row to remove';
  end if;

  -- Rollback material
  create table public._app_dedupe_20261004_refs as
    select 'matches'::text as tbl, m.id as row_id, m.app_id as old_app_id
      from public.matches m join public._app_dedupe_20261004 d on d.remove_id = m.app_id
    union all
    select 'app_comments.app_id', c.id, c.app_id
      from public.app_comments c join public._app_dedupe_20261004 d on d.remove_id = c.app_id
    union all
    select 'app_comments.promoted_app_id', c.id, c.promoted_app_id
      from public.app_comments c join public._app_dedupe_20261004 d on d.remove_id = c.promoted_app_id;
  get diagnostics n_refs = row_count;
  alter table public._app_dedupe_20261004_refs enable row level security;

  create table public._app_dedupe_20261004_notifications as
    select n.* from public.notifications n join public._app_dedupe_20261004 d
      on n.link in ('/apps/' || d.remove_id, '/browse/' || d.remove_id);
  get diagnostics n_notif_backup = row_count;
  alter table public._app_dedupe_20261004_notifications enable row level security;

  -- Notifications: drop the repeats, re-point the rest
  delete from public.notifications n using public._app_dedupe_20261004 d
   where n.link = '/apps/' || d.remove_id
     and exists (select 1 from public.notifications k
                  where k.user_id = n.user_id and k.type = n.type and k.link = '/apps/' || d.keep_id);
  get diagnostics n_notif_del = row_count;
  update public.notifications n set link = '/apps/' || d.keep_id
    from public._app_dedupe_20261004 d where n.link = '/apps/' || d.remove_id;
  get diagnostics n_notif_apps = row_count;
  update public.notifications n set link = '/browse/' || d.keep_id
    from public._app_dedupe_20261004 d where n.link = '/browse/' || d.remove_id;
  get diagnostics n_notif_browse = row_count;

  -- References
  update public.app_comments c set promoted_app_id = d.keep_id
    from public._app_dedupe_20261004 d where c.promoted_app_id = d.remove_id;
  get diagnostics n_promo = row_count;
  update public.app_comments c set app_id = d.keep_id
    from public._app_dedupe_20261004 d where c.app_id = d.remove_id;
  get diagnostics n_comment = row_count;
  update public.matches m set app_id = d.keep_id
    from public._app_dedupe_20261004 d where m.app_id = d.remove_id;
  get diagnostics n_match = row_count;

  -- Soft delete
  update public.apps a set status = 'deleted'
    from public._app_dedupe_20261004 d where a.id = d.remove_id;
  get diagnostics n_apps = row_count;

  select count(*) into n_live from public.apps where status <> 'deleted';

  counts := jsonb_build_object(
    'pairs', n_map, 'refs_backed_up', n_refs, 'notifications_backed_up', n_notif_backup,
    'notifications_deleted', n_notif_del, 'notifications_repointed_apps', n_notif_apps,
    'notifications_repointed_browse', n_notif_browse, 'promoted_repointed', n_promo,
    'comments_repointed', n_comment, 'matches_repointed', n_match,
    'apps_soft_deleted', n_apps, 'live_apps_after', n_live,
    'leftover_refs', (
      select count(*) from public._app_dedupe_20261004 d
       where exists (select 1 from public.matches m where m.app_id = d.remove_id)
          or exists (select 1 from public.app_comments c where c.app_id = d.remove_id or c.promoted_app_id = d.remove_id)
          or exists (select 1 from public.notifications n where n.link in ('/apps/' || d.remove_id, '/browse/' || d.remove_id))
    )
  );

  -- Refuse to commit anything other than the reviewed numbers.
  if n_map <> 84 or n_apps <> 84 or n_match <> 17 or n_comment <> 10 or n_promo <> 7
     or n_notif_del <> 73 or n_notif_apps <> 2 or n_notif_browse <> 0
     or (counts->>'leftover_refs')::int <> 0 then
    raise exception 'MISMATCH %', counts::text;
  end if;

  if dry_run then
    raise exception 'DRYRUN_OK %', counts::text;
  end if;
end $$;
```

### 되돌리기

```sql
begin;
update public.apps a set status = d.prev_status
  from public._app_dedupe_20261004 d where a.id = d.remove_id;
update public.matches m set app_id = r.old_app_id
  from public._app_dedupe_20261004_refs r where r.tbl = matches and m.id = r.row_id;
update public.app_comments c set app_id = r.old_app_id
  from public._app_dedupe_20261004_refs r where r.tbl = app_comments.app_id and c.id = r.row_id;
update public.app_comments c set promoted_app_id = r.old_app_id
  from public._app_dedupe_20261004_refs r where r.tbl = app_comments.promoted_app_id and c.id = r.row_id;
-- 알림: 링크 교체분 원복 → 삭제분 복원
update public.notifications n set link = b.link
  from public._app_dedupe_20261004_notifications b where n.id = b.id and n.link <> b.link;
insert into public.notifications overriding system value
  select b.* from public._app_dedupe_20261004_notifications b
   where not exists (select 1 from public.notifications n where n.id = b.id);
commit;
```

보관 테이블 3개(`_app_dedupe_20261004`, `_refs`, `_notifications`)는 RLS 를 켠 상태로 남겨 둠(정책 없음 → 서비스 롤만 접근). 되돌릴 일이 없다고 판단되면 삭제.

## 10. 범위 밖 발견 ⏳

- `POST /api/admin/notify-group-upgrade` — 앱·기존 알림 조회에 페이지네이션이 없어 1,000행에서 잘림. 살아있는 앱 1,169행 중 일부는 대상에서 빠지고, group_upgrade 알림이 1,000건을 넘으면 멱등 가드가 뚫려 재발송됨.
- `/apps` (내 앱 목록) — deleted 행을 걸러내지 않음.
