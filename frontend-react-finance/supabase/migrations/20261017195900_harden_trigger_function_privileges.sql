begin;

-- These functions are internal trigger callbacks. They are invoked by Postgres
-- triggers on submissions and feedback and are not intended to be public RPC
-- endpoints. Because they use SECURITY DEFINER, direct EXECUTE access would run
-- with the function owner's privileges, so keep invocation limited to the
-- database trigger path.
revoke execute on function public.enforce_submission_insert_quota()
  from public, anon, authenticated;

revoke execute on function public.enforce_feedback_insert_quota()
  from public, anon, authenticated;

commit;
