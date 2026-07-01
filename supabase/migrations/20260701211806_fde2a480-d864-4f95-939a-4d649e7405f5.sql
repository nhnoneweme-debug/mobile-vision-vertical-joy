ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS notifications_push_queue_idx
  ON public.notifications (user_id, pushed_at) WHERE pushed_at IS NULL;