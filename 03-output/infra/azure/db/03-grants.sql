-- After the public schema is restored (pg_dump --no-privileges drops Supabase's grants).
-- The app reaches PostgREST only from the server (sidecar on localhost) as service_role,
-- so anon/authenticated get no table access at all.
\set ON_ERROR_STOP on

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- service_role bypassed RLS on Supabase. Azure admins cannot grant BYPASSRLS, so give it an
-- explicit allow-all policy on every RLS table instead (existing policies stay as they are).
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    if not exists (select from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'service_role_all') then
      execute format('create policy service_role_all on public.%I for all to service_role using (true) with check (true)', t.relname);
    end if;
  end loop;
end $$;
