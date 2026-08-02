-- ============================================================
-- FATIA 2 — Motor de Gatilhos (aditiva)
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_trigger_definitions_updated_at ON public.trigger_definitions;
--   DROP TABLE IF EXISTS public.trigger_firings;
--   DROP TABLE IF EXISTS public.trigger_definitions;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trigger_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  trigger_type TEXT NOT NULL DEFAULT 'event',
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  cooldown_seconds INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trigger_definitions_type_chk CHECK (trigger_type IN ('chronos','event')),
  CONSTRAINT trigger_definitions_cooldown_chk CHECK (cooldown_seconds BETWEEN 0 AND 86400),
  CONSTRAINT trigger_definitions_name_chk CHECK (char_length(name) BETWEEN 1 AND 120)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trigger_definitions TO authenticated;
GRANT ALL ON public.trigger_definitions TO service_role;

ALTER TABLE public.trigger_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own triggers select" ON public.trigger_definitions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own triggers insert" ON public.trigger_definitions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own triggers update" ON public.trigger_definitions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own triggers delete" ON public.trigger_definitions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS trigger_definitions_user_pos_idx
  ON public.trigger_definitions (user_id, position, created_at);

CREATE TRIGGER trg_trigger_definitions_updated_at
  BEFORE UPDATE ON public.trigger_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trigger_firings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_id UUID NOT NULL REFERENCES public.trigger_definitions(id) ON DELETE CASCADE,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_kind TEXT,
  source_ref TEXT,
  result TEXT NOT NULL DEFAULT 'executed',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trigger_firings_result_chk CHECK (result IN ('executed','suppressed_cooldown','failed'))
);

-- append-only: sem UPDATE/DELETE para authenticated
GRANT SELECT, INSERT ON public.trigger_firings TO authenticated;
GRANT ALL ON public.trigger_firings TO service_role;

ALTER TABLE public.trigger_firings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own firings select" ON public.trigger_firings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own firings insert" ON public.trigger_firings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS trigger_firings_user_time_idx
  ON public.trigger_firings (user_id, fired_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS trigger_firings_idempotency_idx
  ON public.trigger_firings (trigger_id, source_ref)
  WHERE source_ref IS NOT NULL;