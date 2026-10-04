-- Member-row linking triggers on auth.users (from migrations 20260504000002 and 20261003000023).
-- Create them only AFTER auth data is loaded, or the load would create duplicate member rows.
\set ON_ERROR_STOP on

grant references, trigger on auth.users to current_user;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_auth_user();
