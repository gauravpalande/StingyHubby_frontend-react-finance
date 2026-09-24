begin;

-- Fixed-window counters used by server-side API routes before calling paid services.
create table if not exists public.api_rate_limits (
  rate_limit_key text primary key,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant all on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_count integer;
  v_started_at timestamptz;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'Invalid rate-limit key';
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits (
    rate_limit_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_key, v_now, 1, v_now)
  on conflict (rate_limit_key) do update
  set
    request_count = case
      when api_rate_limits.window_started_at + v_window <= v_now then 1
      else api_rate_limits.request_count + 1
    end,
    window_started_at = case
      when api_rate_limits.window_started_at + v_window <= v_now then v_now
      else api_rate_limits.window_started_at
    end,
    updated_at = v_now
  where api_rate_limits.window_started_at + v_window <= v_now
     or api_rate_limits.request_count <= p_limit
  returning request_count, window_started_at
  into v_count, v_started_at;

  -- Once a key is blocked, read its existing window without producing another
  -- database write for every abusive retry.
  if v_count is null then
    select request_count, window_started_at
    into v_count, v_started_at
    from public.api_rate_limits
    where rate_limit_key = p_key;
  end if;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (v_started_at + v_window - v_now)))::integer
    )
  end;

  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

-- A delivery claim prevents duplicate Vercel cron invocations from sending the same
-- paid email/attachment work more than once for a user and reporting period.
create table if not exists public.scheduled_email_deliveries (
  digest_type text not null,
  period_key text not null,
  user_id uuid not null,
  status text not null default 'running'
    check (status in ('running', 'sent', 'skipped', 'failed')),
  claimed_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  last_error text,
  primary key (digest_type, period_key, user_id)
);

create index if not exists scheduled_email_deliveries_claimed_at_idx
  on public.scheduled_email_deliveries (claimed_at);

alter table public.scheduled_email_deliveries enable row level security;
revoke all on table public.scheduled_email_deliveries from public, anon, authenticated;
grant all on table public.scheduled_email_deliveries to service_role;

create or replace function public.claim_scheduled_email_delivery(
  p_digest_type text,
  p_period_key text,
  p_user_id uuid,
  p_stale_after_seconds integer default 7200
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_claimed boolean;
begin
  if p_digest_type is null or length(p_digest_type) = 0 or length(p_digest_type) > 40 then
    raise exception 'Invalid digest type';
  end if;

  if p_period_key is null or length(p_period_key) = 0 or length(p_period_key) > 40 then
    raise exception 'Invalid period key';
  end if;

  if p_user_id is null or p_stale_after_seconds < 60 then
    raise exception 'Invalid delivery claim';
  end if;

  insert into public.scheduled_email_deliveries (
    digest_type,
    period_key,
    user_id,
    status,
    claimed_at
  )
  values (p_digest_type, p_period_key, p_user_id, 'running', v_now)
  on conflict (digest_type, period_key, user_id) do update
  set
    status = 'running',
    claimed_at = v_now,
    completed_at = null,
    last_error = null
  where scheduled_email_deliveries.status = 'failed'
     or (
       scheduled_email_deliveries.status = 'running'
       and scheduled_email_deliveries.claimed_at
         < v_now - make_interval(secs => p_stale_after_seconds)
     )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_scheduled_email_delivery(text, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_scheduled_email_delivery(text, text, uuid, integer)
  to service_role;

-- Daily counters limit direct authenticated writes made with the public Supabase key.
create table if not exists public.user_daily_write_usage (
  user_id uuid not null,
  usage_date date not null,
  resource text not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, usage_date, resource)
);

create index if not exists user_daily_write_usage_date_idx
  on public.user_daily_write_usage (usage_date);

alter table public.user_daily_write_usage enable row level security;
revoke all on table public.user_daily_write_usage from public, anon, authenticated;
grant all on table public.user_daily_write_usage to service_role;

create or replace function public.consume_user_daily_write_quota(
  p_user_id uuid,
  p_resource text,
  p_amount integer,
  p_limit integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_today date := (clock_timestamp() at time zone 'utc')::date;
begin
  if p_user_id is null or p_amount < 1 or p_limit < 1 or p_amount > p_limit then
    raise exception 'Invalid write quota request';
  end if;

  insert into public.user_daily_write_usage (
    user_id,
    usage_date,
    resource,
    request_count,
    updated_at
  )
  values (p_user_id, v_today, p_resource, p_amount, clock_timestamp())
  on conflict (user_id, usage_date, resource) do update
  set
    request_count = user_daily_write_usage.request_count + excluded.request_count,
    updated_at = clock_timestamp()
  where user_daily_write_usage.request_count + excluded.request_count <= p_limit
  returning request_count into v_count;

  if v_count is null then
    raise exception 'Daily % write limit reached', p_resource
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.consume_user_daily_write_quota(uuid, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.validate_submission_cost_bounds()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Authentication is required to write submissions'
        using errcode = '42501';
    end if;

    if new.user_id is distinct from auth.uid() then
      raise exception 'Submission user does not match the authenticated user'
        using errcode = '42501';
    end if;
  end if;

  if coalesce(abs(new.income), 0) > 1000000000000
    or coalesce(abs(new.checking), 0) > 1000000000000
    or coalesce(abs(new.emergency), 0) > 1000000000000
    or coalesce(abs(new.health), 0) > 1000000000000
    or coalesce(abs(new.retirement), 0) > 1000000000000
    or coalesce(abs(new."creditCards"), 0) > 1000000000000
    or coalesce(abs(new.mortgage), 0) > 1000000000000
    or coalesce(abs(new."carPayments"), 0) > 1000000000000
    or coalesce(abs(new.utilities), 0) > 1000000000000 then
    raise exception 'Financial values must be between -1 trillion and 1 trillion';
  end if;

  if char_length(coalesce(new.short_term_suggestion, '')) > 4000
    or char_length(coalesce(new.long_term_suggestion, '')) > 4000
    or char_length(coalesce(new.goal_suggestion, '')) > 4000
    or char_length(coalesce(new.oneline_suggestion, '')) > 1000 then
    raise exception 'Suggestion text is too long';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_submission_cost_bounds_trigger on public.submissions;
create trigger validate_submission_cost_bounds_trigger
before insert or update on public.submissions
for each row execute function public.validate_submission_cost_bounds();

create or replace function public.enforce_submission_insert_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authenticated_user uuid := auth.uid();
  v_insert_user uuid;
  v_distinct_users integer;
  v_row_count integer;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return null;
  end if;

  if v_authenticated_user is null then
    raise exception 'Authentication is required to write submissions'
      using errcode = '42501';
  end if;

  select count(*), count(distinct user_id)
  into v_row_count, v_distinct_users
  from new_submission_rows;

  select user_id
  into v_insert_user
  from new_submission_rows
  limit 1;

  if v_row_count > 500 then
    raise exception 'A maximum of 500 financial records can be imported at once';
  end if;

  if v_distinct_users <> 1 or v_insert_user is distinct from v_authenticated_user then
    raise exception 'Submission user does not match the authenticated user'
      using errcode = '42501';
  end if;

  perform public.consume_user_daily_write_quota(
    v_authenticated_user,
    'submissions',
    v_row_count,
    500
  );

  return null;
end;
$$;

drop trigger if exists enforce_submission_insert_quota_trigger on public.submissions;
create trigger enforce_submission_insert_quota_trigger
after insert on public.submissions
referencing new table as new_submission_rows
for each statement execute function public.enforce_submission_insert_quota();

create or replace function public.validate_feedback_cost_bounds()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Authentication is required to write feedback'
        using errcode = '42501';
    end if;

    if new.user_id is distinct from auth.uid() then
      raise exception 'Feedback user does not match the authenticated user'
        using errcode = '42501';
    end if;
  end if;

  if char_length(coalesce(new.title, '')) > 160
    or char_length(coalesce(new.description, '')) > 5000 then
    raise exception 'Feedback content is too long';
  end if;

  if new.type not in ('feature', 'bug', 'security') then
    raise exception 'Feedback type is invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_feedback_cost_bounds_trigger on public.feedback;
create trigger validate_feedback_cost_bounds_trigger
before insert or update on public.feedback
for each row execute function public.validate_feedback_cost_bounds();

create or replace function public.enforce_feedback_insert_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authenticated_user uuid := auth.uid();
  v_insert_user uuid;
  v_distinct_users integer;
  v_row_count integer;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return null;
  end if;

  if v_authenticated_user is null then
    raise exception 'Authentication is required to write feedback'
      using errcode = '42501';
  end if;

  select count(*), count(distinct user_id)
  into v_row_count, v_distinct_users
  from new_feedback_rows;

  select user_id
  into v_insert_user
  from new_feedback_rows
  limit 1;

  if v_distinct_users <> 1 or v_insert_user is distinct from v_authenticated_user then
    raise exception 'Feedback user does not match the authenticated user'
      using errcode = '42501';
  end if;

  perform public.consume_user_daily_write_quota(
    v_authenticated_user,
    'feedback',
    v_row_count,
    20
  );

  return null;
end;
$$;

drop trigger if exists enforce_feedback_insert_quota_trigger on public.feedback;
create trigger enforce_feedback_insert_quota_trigger
after insert on public.feedback
referencing new table as new_feedback_rows
for each statement execute function public.enforce_feedback_insert_quota();

-- Scheduled cleanup keeps the protection tables from becoming a new source of
-- unbounded storage cost. The weekly and monthly cron routes call this function.
create or replace function public.cleanup_cost_protection_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.api_rate_limits
  where updated_at < clock_timestamp() - interval '2 days';

  delete from public.user_daily_write_usage
  where usage_date < (clock_timestamp() at time zone 'utc')::date - 8;

  delete from public.scheduled_email_deliveries
  where claimed_at < clock_timestamp() - interval '400 days';
end;
$$;

revoke all on function public.cleanup_cost_protection_data()
  from public, anon, authenticated;
grant execute on function public.cleanup_cost_protection_data()
  to service_role;

commit;
