CREATE TABLE public.action_push_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.trigger_definitions(id) ON DELETE CASCADE,
  fire_at timestamptz NOT NULL,
  tz text NOT NULL DEFAULT 'UTC',
  title text,
  body text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_push_schedule_unique ON public.action_push_schedule (trigger_id, fire_at);
CREATE INDEX action_push_schedule_pending ON public.action_push_schedule (fire_at) WHERE sent_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_push_schedule TO authenticated;
GRANT ALL ON public.action_push_schedule TO service_role;

ALTER TABLE public.action_push_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own action schedule" ON public.action_push_schedule
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);