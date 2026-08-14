-- 2026-08-14: 신뢰도 점수 미반영 버그 수정
--
-- users_protect_admin_fields 트리거가 is_admin() 이 아닌 모든 UPDATE 에서
-- trust_score 를 조용히 원복 — service_role(서버) 의 정당한 가점/감점까지
-- 막혀 trust_score_history 원장에는 기록되고 실제 점수는 50 고정이었다.
-- (service_role 은 RLS 는 우회하지만 트리거는 우회하지 못한다)

-- 1) 트리거 함수: service_role 요청은 보호 대상에서 제외
create or replace function public.users_protect_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    new.role        := old.role;
    new.trust_score := old.trust_score;
    new.status      := old.status;
  end if;
  return new;
end;
$$;

-- 2) 원장 기준 전면 보정 (마이그레이션 컨텍스트도 auth.role() 이 없어
--    트리거에 막히므로 잠시 내리고 실행)
alter table public.users disable trigger users_protect_admin_fields_trg;

-- 2a) history 의 score_after 재계산 (기록 당시 매번 50 기준으로 잘못 계산돼 있었음)
--     델타 누적 후 clamp — 스텝별 clamp 와 미세 차이가 있을 수 있으나
--     시작 50·델타(+1/-3/-10) 특성상 실질 차이 없음
with cum as (
  select id,
         50 + sum(delta) over (partition by user_id order by id) as running
  from public.trust_score_history
)
update public.trust_score_history h
set score_after = greatest(0, least(1000, cum.running))
from cum
where cum.id = h.id
  and h.score_after <> greatest(0, least(1000, cum.running));

-- 2b) users.trust_score = 50 + 델타 합 (clamp 0~1000)
update public.users u
set trust_score = greatest(0, least(1000, 50 + s.total))
from (
  select user_id, sum(delta) as total
  from public.trust_score_history
  group by user_id
) s
where s.user_id = u.id
  and u.trust_score <> greatest(0, least(1000, 50 + s.total));

alter table public.users enable trigger users_protect_admin_fields_trg;
