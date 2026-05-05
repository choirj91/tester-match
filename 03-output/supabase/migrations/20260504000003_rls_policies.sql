-- =====================================================================
-- Tester Match — RLS 정책 (ADR-0004 후속)
-- 작성일: 2026-05-04
-- 모델: 클라이언트(anon/authenticated)는 정책으로 통제, 서버 admin client
--      (service_role)는 RLS 우회. 정책은 SELECT/INSERT/UPDATE/DELETE 별도.
-- 기본 원칙:
--   - 본인 데이터(auth_user_id 매핑)만 읽기/쓰기
--   - admin role 은 전체 읽기 + 일부 쓰기
--   - apps.status='matching' 만 다른 사용자가 SELECT 가능 (브라우징)
--   - credits_ledger/payments/audit_logs 등 금전·감사 기록은 클라이언트 쓰기 차단
--   - waitlist_signups 는 클라이언트 전체 차단 (서버 admin 만)
-- 비고:
--   - 다른 사용자의 nickname/trust_score 노출은 본 마이그레이션 범위 외.
--     매칭 화면에서 필요해질 때 users_public_profile view + 권한 부여로 처리.
-- =====================================================================

-- ── 헬퍼 함수 ─────────────────────────────────────────────────────────
-- security definer 로 RLS 우회하여 users 테이블 lookup. search_path 고정.

create or replace function public.current_app_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.users where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

-- ── users.role / trust_score / status 보호 ───────────────────────────
-- 클라이언트가 본인 row UPDATE 시 권한 상승(role='admin') 차단.
-- 비-admin 의 변경 시도는 silently 원복.

create or replace function public.users_protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role        := old.role;
    new.trust_score := old.trust_score;
    new.status      := old.status;
  end if;
  return new;
end;
$$;

create trigger users_protect_admin_fields_trg
  before update on public.users
  for each row execute function public.users_protect_admin_fields();

-- =====================================================================
-- 정책 — 테이블별
-- =====================================================================

-- 2.1 users
create policy users_select_own_or_admin
  on public.users for select
  to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

create policy users_update_own
  on public.users for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- INSERT/DELETE 는 트리거/서버에서만. 정책 없음 → 차단.

-- 2.2 devices — 본인 디바이스만
create policy devices_all_own
  on public.devices for all
  to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

-- 2.3 apps
create policy apps_select_matching_or_own
  on public.apps for select
  to authenticated
  using (
    status = 'matching'
    or owner_user_id = public.current_app_user_id()
    or public.is_admin()
  );

create policy apps_insert_own
  on public.apps for insert
  to authenticated
  with check (owner_user_id = public.current_app_user_id());

create policy apps_update_own
  on public.apps for update
  to authenticated
  using (owner_user_id = public.current_app_user_id())
  with check (owner_user_id = public.current_app_user_id());

create policy apps_delete_own
  on public.apps for delete
  to authenticated
  using (owner_user_id = public.current_app_user_id());

-- 2.4 matches — 참여자(테스터/앱 owner) SELECT. 쓰기는 매칭 엔진(서버)만.
create policy matches_select_participants
  on public.matches for select
  to authenticated
  using (
    tester_user_id = public.current_app_user_id()
    or exists (
      select 1 from public.apps a
      where a.id = matches.app_id
        and a.owner_user_id = public.current_app_user_id()
    )
    or public.is_admin()
  );

-- 2.5 checkins — 본인 매치만 INSERT, 양측 SELECT
create policy checkins_select_participants
  on public.checkins for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = checkins.match_id
        and (
          m.tester_user_id = public.current_app_user_id()
          or exists (
            select 1 from public.apps a
            where a.id = m.app_id
              and a.owner_user_id = public.current_app_user_id()
          )
        )
    )
    or public.is_admin()
  );

create policy checkins_insert_own_active_match
  on public.checkins for insert
  to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = checkins.match_id
        and m.tester_user_id = public.current_app_user_id()
        and m.status = 'active'
    )
  );

-- 2.6 credits_ledger — 본인 SELECT 만. 쓰기는 server only (append-only 트리거 별도).
create policy credits_select_own_or_admin
  on public.credits_ledger for select
  to authenticated
  using (user_id = public.current_app_user_id() or public.is_admin());

-- 2.7 payments — 본인 SELECT 만.
create policy payments_select_own_or_admin
  on public.payments for select
  to authenticated
  using (user_id = public.current_app_user_id() or public.is_admin());

-- 2.8 boost_orders — 앱 owner / admin SELECT.
create policy boost_orders_select_owner_or_admin
  on public.boost_orders for select
  to authenticated
  using (
    exists (
      select 1 from public.apps a
      where a.id = boost_orders.app_id
        and a.owner_user_id = public.current_app_user_id()
    )
    or public.is_admin()
  );

-- 2.9 reports — reporter 자신 SELECT/INSERT. UPDATE 는 admin 만.
create policy reports_select_reporter_or_admin
  on public.reports for select
  to authenticated
  using (reporter_user_id = public.current_app_user_id() or public.is_admin());

create policy reports_insert_self_reporter
  on public.reports for insert
  to authenticated
  with check (reporter_user_id = public.current_app_user_id());

create policy reports_update_admin
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2.10 trust_score_history — 본인 SELECT.
create policy trust_score_select_own_or_admin
  on public.trust_score_history for select
  to authenticated
  using (user_id = public.current_app_user_id() or public.is_admin());

-- 2.11 notification_prefs — 본인 전권.
create policy notification_prefs_all_own
  on public.notification_prefs for all
  to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

-- 2.13 audit_logs — admin 만 SELECT. INSERT 는 server only.
create policy audit_logs_select_admin
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- waitlist_signups — 클라이언트 전체 차단 (서버 admin 만 사용).
-- 정책 없음 → RLS 가 모두 거부.
