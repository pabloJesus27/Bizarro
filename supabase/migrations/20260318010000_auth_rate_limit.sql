create table auth_attempts (
  id            bigserial    primary key,
  identifier    text         not null,
  action        text         not null,
  attempted_at  timestamptz  not null default now()
);

create index auth_attempts_lookup_idx
  on auth_attempts (identifier, action, attempted_at desc);

alter table auth_attempts enable row level security;
revoke all on auth_attempts from anon, authenticated;

create or replace function check_and_record_auth_attempt(
  p_identifier     text,
  p_action         text,
  p_limit          int,
  p_window_minutes int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count        int;
  v_window_start timestamptz := now() - (p_window_minutes * interval '1 minute');
begin
  select count(*) into v_count
    from auth_attempts
   where identifier   = lower(p_identifier)
     and action       = p_action
     and attempted_at >= v_window_start;

  if v_count >= p_limit then
    return false;
  end if;

  insert into auth_attempts (identifier, action)
  values (lower(p_identifier), p_action);

  return true;
end;
$$;

revoke execute on function check_and_record_auth_attempt(text, text, int, int) from anon, authenticated;
grant  execute on function check_and_record_auth_attempt(text, text, int, int) to service_role;

-- Cleanup (run manually in Supabase SQL editor):
-- SELECT cron.schedule('cleanup-auth-attempts', '0 4 * * *',
--   $$DELETE FROM auth_attempts WHERE attempted_at < now() - interval '24 hours'$$);
