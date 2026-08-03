CREATE TABLE IF NOT EXISTS public.persona_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  intent text,
  schema_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  wi jsonb NOT NULL DEFAULT '{}'::jsonb,
  mi jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS persona_profiles_user_idx ON public.persona_profiles (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_profiles TO authenticated;
GRANT ALL ON public.persona_profiles TO service_role;

ALTER TABLE public.persona_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persona_profiles_own_all" ON public.persona_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER persona_profiles_touch
  BEFORE UPDATE ON public.persona_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS persona_profiles_touch ON public.persona_profiles;
-- DROP POLICY IF EXISTS "persona_profiles_own_all" ON public.persona_profiles;
-- DROP TABLE IF EXISTS public.persona_profiles;