
CREATE TABLE public.belief_confrontations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  belief TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  faced BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, belief, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.belief_confrontations TO authenticated;
GRANT ALL ON public.belief_confrontations TO service_role;

ALTER TABLE public.belief_confrontations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.belief_confrontations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.belief_confrontations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.belief_confrontations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.belief_confrontations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX belief_confrontations_user_date_idx ON public.belief_confrontations(user_id, log_date DESC);
