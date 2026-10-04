-- Supabase-compatible roles and schemas on Azure Database for PostgreSQL (ADR-0015 phase 2).
-- Run as the server admin on database `testermatch`. Passwords come from psql variables
-- (-v authenticator_password=... -v auth_admin_password=...) — never commit them.
\set ON_ERROR_STOP on

create extension if not exists citext with schema public;
create extension if not exists pgcrypto with schema public;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login noinherit createrole; end if;
  -- GoTrue migrations grant on auth tables to a role named postgres (Supabase's superuser). Azure has none.
  if not exists (select from pg_roles where rolname = 'postgres') then create role postgres nologin noinherit; end if;
end $$;

alter role authenticator with password :'authenticator_password';
alter role supabase_auth_admin with password :'auth_admin_password';

-- PostgREST connects as authenticator and switches to these roles per request
grant anon, authenticated, service_role to authenticator;
-- the admin may act as the auth owner (create triggers on auth.users, load data)
grant supabase_auth_admin to current_user;

create schema if not exists auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema auth to service_role, authenticated, anon;
grant create on database testermatch to supabase_auth_admin;
