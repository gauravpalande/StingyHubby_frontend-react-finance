begin;

-- Resolve the authenticated user once per statement in each user-owned policy.
-- This preserves the ownership checks while avoiding per-row auth.uid() evaluation.
drop policy if exists "Users can insert feedback" on public.feedback;
create policy "Users can insert feedback"
  on public.feedback
  for insert
  to public
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own feedback" on public.feedback;
create policy "Users can read their own feedback"
  on public.feedback
  for select
  to public
  using ((select auth.uid()) = user_id);

drop policy if exists "User can manage own goals" on public.goals;
create policy "User can manage own goals"
  on public.goals
  for all
  to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own preferences" on public.preferences;
create policy "Users manage own preferences"
  on public.preferences
  for all
  to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "User can manage own submissions" on public.submissions;
create policy "User can manage own submissions"
  on public.submissions
  for all
  to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow insert/update for self" on public.users;
create policy "Allow insert/update for self"
  on public.users
  for all
  to public
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

commit;
