-- Table
create table ai_usage (
  id          bigserial   primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  endpoint    text        not null,
  used_at     date        not null default (now() at time zone 'utc')::date,
  created_at  timestamptz not null default now()
);

create index ai_usage_lookup_idx
  on ai_usage (user_id, endpoint, used_at);

alter table ai_usage enable row level security;

create policy "ai_usage: users see own rows"
  on ai_usage for select
  using (user_id = auth.uid());

create or replace function check_and_increment_ai_usage(
  p_user_id  uuid,
  p_endpoint text,
  p_limit    int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  cnt   int;
begin
  if auth.uid() is not null and auth.uid() != p_user_id then
    raise exception 'forbidden: cannot consume another user quota';
  end if;

  select count(*) into cnt
  from ai_usage
  where user_id  = p_user_id
    and endpoint = p_endpoint
    and used_at  = today;

  if cnt >= p_limit then
    return false;
  end if;

  insert into ai_usage (user_id, endpoint, used_at)
  values (p_user_id, p_endpoint, today);

  return true;
end;
$$;
