# 인앱 알림 시스템 구현 — 2026-05-16

## 개요

사용자 참여 핵심 이벤트(테스터 참여·완주·페널티·댓글·D-day)에 대한 인앱 알림 시스템을 구현했다.
Firebase/외부 Push 없이 Supabase `notifications` 테이블 + 폴링 방식으로 MVP 요건 충족.

---

## 변경 범위

### DB (마이그레이션)
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260516000001_notifications.sql` | `notifications` 테이블, RLS 2개 정책, 복합 인덱스 |

```sql
-- 타입 체크 (DB 레벨 제약)
type IN ('match_new','match_reminder','match_completed','match_penalized','comment_new','post_comment')
-- 인덱스: 미읽음 빠른 카운트
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, is_read, created_at DESC);
```

### 서버 라이브러리
| 파일 | 역할 |
|---|---|
| `src/lib/notifications.ts` | `createNotification()` 헬퍼 — fire-and-forget, 절대 메인 요청 블로킹 X |

### API 엔드포인트
| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/notifications` | GET | `?count=1` → 미읽음 수만, 기본 → 최근 50건 목록 |
| `/api/notifications` | PATCH | 전체 읽음 처리 |

### 알림 트리거 6곳
| 트리거 파일 | 이벤트 | 타입 |
|---|---|---|
| `api/matches/route.ts` | 테스터 앱 참여 | `match_new` (앱 소유자에게) |
| `api/matches/[id]/checkins/route.ts` | 14일 완주 | `match_completed` (테스터에게) |
| `api/cron/penalty-sweep/route.ts` | 미체크인 페널티 | `match_penalized` (테스터에게) |
| `api/cron/daily-checkin-reminder/route.ts` | 오늘 미체크인 | `match_reminder` (테스터에게, 앱별) |
| `api/apps/[id]/comments/route.ts` | 앱 댓글 | `comment_new` (앱 소유자에게) |
| `api/posts/[id]/comments/route.ts` | 게시글 댓글 | `post_comment` (게시글 작성자에게) |

> 모든 트리거는 `void createNotification(...)` — 실패해도 메인 응답에 영향 없음.

### 프론트엔드
| 파일 | 역할 |
|---|---|
| `components/notification-bell.tsx` | 헤더 알림 종 아이콘. 60초 폴링, 미읽음 수 뱃지 (빨간 원) |
| `app/notifications/page.tsx` | 알림 목록 페이지 (edge runtime). 진입 시 자동 전체 읽음 처리 |
| `app/notifications/notification-list.tsx` | 목록 클라이언트 컴포넌트. 이모지 아이콘·상대시간·링크 이동 |
| `components/site-header.tsx` | `<NotificationBell />` 로그인 사용자에게 노출 |

---

## 설계 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| Push vs Poll | 60초 폴링 (SSE·WebSocket 없음) | Edge runtime 제약, MVP 범위 내 충분 |
| 읽음 처리 시점 | `/notifications` 페이지 로드 시 전체 읽음 | UX 단순화. PATCH API는 외부 호출용으로 유지 |
| 알림 보관 기간 | 최신 50건 (API 제한) | DB 정리 크론은 v2 |
| 자기 댓글 제외 | `if (author !== user.id)` 가드 | 본인 행위 알림 불필요 |
| 현재 앱 자기 홍보 차단 | `if (pApp.id === appId)` 가드 | 앱 댓글 promoted_app 중복 방지 |

---

## 배포 정보

- **커밋**: `625d0e0` feat: 인앱 알림 시스템 구현
- **마이그레이션**: `20260516000001_notifications.sql` — `npx supabase db push` 완료
- **배포 URL**: https://9fe785e8.tester-match.pages.dev (→ 프로덕션 반영)
- **타입체크**: 통과
- **빌드**: Cloudflare Pages 정상 (`Build completed in 4.29s`)
