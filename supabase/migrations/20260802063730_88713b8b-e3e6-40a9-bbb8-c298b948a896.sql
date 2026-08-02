-- ============ FATIA 3 — Gatilho Studio (aditiva) ============

-- 1) Janela ativa opcional
ALTER TABLE public.trigger_definitions
  ADD COLUMN IF NOT EXISTS active_window jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trigger_definitions.active_window IS
  'Opcional: {"start":"08:00","end":"18:00","days":[1,2,3,4,5]} — vazio = sempre elegivel';

-- 2) result agora aceita "simulated"
ALTER TABLE public.trigger_firings DROP CONSTRAINT IF EXISTS trigger_firings_result_chk;
ALTER TABLE public.trigger_firings ADD CONSTRAINT trigger_firings_result_chk
  CHECK (result = ANY (ARRAY['executed','suppressed_cooldown','failed','simulated']));

-- 3) Versões append-only
CREATE TABLE IF NOT EXISTS public.trigger_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  trigger_id uuid NOT NULL REFERENCES public.trigger_definitions(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_id, revision)
);

CREATE INDEX IF NOT EXISTS trigger_revisions_trigger_idx
  ON public.trigger_revisions (trigger_id, revision DESC);

GRANT SELECT, INSERT ON public.trigger_revisions TO authenticated;
GRANT ALL ON public.trigger_revisions TO service_role;

ALTER TABLE public.trigger_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own revisions select" ON public.trigger_revisions;
CREATE POLICY "own revisions select" ON public.trigger_revisions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own revisions insert" ON public.trigger_revisions;
CREATE POLICY "own revisions insert" ON public.trigger_revisions
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.trigger_definitions td
      WHERE td.id = trigger_id AND td.user_id = auth.uid()
    )
  );

-- append-only: sem policies de UPDATE/DELETE

-- ============ ROLLBACK ============
-- DROP TABLE IF EXISTS public.trigger_revisions;
-- ALTER TABLE public.trigger_firings DROP CONSTRAINT IF EXISTS trigger_firings_result_chk;
-- ALTER TABLE public.trigger_firings ADD CONSTRAINT trigger_firings_result_chk
--   CHECK (result = ANY (ARRAY['executed','suppressed_cooldown','failed']));
-- ALTER TABLE public.trigger_definitions DROP COLUMN IF EXISTS active_window;
