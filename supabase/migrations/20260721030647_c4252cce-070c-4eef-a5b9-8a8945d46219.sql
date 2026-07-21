
CREATE TABLE public.journey_push_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('preEnd','atEnd','preStart')),
  fire_at timestamptz NOT NULL,
  tz text NOT NULL DEFAULT 'UTC',
  title text,
  body text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, phase, fire_at)
);

GRANT SELECT, DELETE ON public.journey_push_schedule TO authenticated;
GRANT ALL ON public.journey_push_schedule TO service_role;

ALTER TABLE public.journey_push_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows readable"
  ON public.journey_push_schedule
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own rows deletable"
  ON public.journey_push_schedule
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX journey_push_schedule_due_idx
  ON public.journey_push_schedule (fire_at)
  WHERE sent_at IS NULL;

CREATE INDEX journey_push_schedule_user_idx
  ON public.journey_push_schedule (user_id, fire_at);
