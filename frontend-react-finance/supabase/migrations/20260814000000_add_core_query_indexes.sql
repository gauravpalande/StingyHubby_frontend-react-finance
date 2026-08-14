-- Improve the main per-user history queries used by dashboards, suggestions, exports, and digest jobs.
create index if not exists submissions_user_id_created_at_idx
  on public.submissions (user_id, created_at desc);

-- Speed up single-user preference reads and updates.
create index if not exists preferences_user_id_idx
  on public.preferences (user_id);

-- Speed up weekly digest recipient discovery while keeping the index small.
create index if not exists preferences_weekly_digest_enabled_idx
  on public.preferences (user_id)
  where email_weekly_digest = true;

-- Speed up monthly digest recipient discovery while keeping the index small.
create index if not exists preferences_monthly_digest_enabled_idx
  on public.preferences (user_id)
  where email_monthly_digest = true;

-- Speed up single-user goal reads and upserts.
create index if not exists goals_user_id_idx
  on public.goals (user_id);

-- Speed up Stripe webhook lookups by customer ID without indexing empty values.
create index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;
