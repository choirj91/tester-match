-- Same query on Supabase and Azure; the outputs must be identical (05-migration-plan §2-4).
-- Prints aggregates only — no personal data.
\pset format unaligned
\pset tuples_only on
select 'rows ' || table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name;
select 'auth.users ' || count(*) from auth.users;
select 'auth.identities ' || provider || ' ' || count(*) from auth.identities group by provider order by provider;
select 'auth.confirmed ' || count(*) filter (where email_confirmed_at is not null) || '/' || count(*) from auth.users;
select 'ledger total ' || count(*) || ' sum ' || coalesce(sum(amount), 0) from public.credits_ledger;
select 'ledger by type ' || type || ' ' || coalesce(ref_type, '-') || ' ' || count(*) || ' ' || sum(amount) from public.credits_ledger group by type, ref_type order by 1;
select 'ledger per-user hash ' || md5(coalesce(string_agg(user_id || ':' || s, ',' order by user_id), '')) from (select user_id, sum(amount) s from public.credits_ledger group by user_id) x;
select 'orders ' || status || ' ' || count(*) from public.paid_tester_orders group by status order by 1;
select 'payments ' || status || ' ' || count(*) from public.payments group by status order by 1;
select 'seat_rewards ' || status || ' ' || count(*) from public.seat_rewards group by status order by 1;
select 'matches ' || status || ' ' || count(*) from public.matches group by status order by 1;
select 'active match checkin hash ' || md5(coalesce(string_agg(m.id || ':' || m.opted_in_at || ':' || coalesce(c.n, 0), ',' order by m.id), ''))
  from public.matches m left join (select match_id, count(distinct day_n) n from public.checkins group by match_id) c on c.match_id = m.id
  where m.status = 'active';
select 'users.auth_user_id dangling ' || count(*) from public.users u where u.auth_user_id is not null and not exists (select 1 from auth.users a where a.id = u.auth_user_id);
