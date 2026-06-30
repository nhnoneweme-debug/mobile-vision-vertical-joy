
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

ALTER TABLE public.area_progress ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.mental_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  gratitudes text[] NOT NULL DEFAULT ARRAY[]::text[],
  limiting_belief text,
  reframe text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mental_journal TO authenticated;
GRANT ALL ON public.mental_journal TO service_role;

ALTER TABLE public.mental_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mental_journal_own_select" ON public.mental_journal FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mental_journal_own_insert" ON public.mental_journal FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mental_journal_own_update" ON public.mental_journal FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mental_journal_own_delete" ON public.mental_journal FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS mental_journal_set_updated_at ON public.mental_journal;
CREATE TRIGGER mental_journal_set_updated_at
  BEFORE UPDATE ON public.mental_journal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
