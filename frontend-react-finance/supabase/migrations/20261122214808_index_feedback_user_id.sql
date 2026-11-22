-- Support per-user feedback reads and foreign-key checks as feedback grows.
create index if not exists feedback_user_id_idx
  on public.feedback (user_id);
