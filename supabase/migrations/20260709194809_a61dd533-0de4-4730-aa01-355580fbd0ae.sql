
-- ============ 20260708000000: security hardening ============
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Public profile fields readable via view" ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_economy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.xp     := OLD.xp;
    NEW.brasas := OLD.brasas;
    NEW.level  := OLD.level;
    NEW.streak := OLD.streak;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_profile_economy ON public.profiles;
CREATE TRIGGER trg_protect_profile_economy
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_economy();

DROP POLICY IF EXISTS "user_crystals_modify_own" ON public.user_crystals;
REVOKE INSERT, UPDATE, DELETE ON public.user_crystals FROM authenticated;

-- ============ 20260708120000: workout module ============
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Novo treino',
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated;
GRANT ALL ON public.workout_plans TO service_role;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_plans" ON public.workout_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workout_plans_user_idx ON public.workout_plans (user_id, created_at DESC);
CREATE TRIGGER workout_plans_touch BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  session_date DATE NOT NULL DEFAULT (now()::date),
  duration_sec INTEGER NOT NULL DEFAULT 0,
  exercises_done INTEGER NOT NULL DEFAULT 0,
  exercises_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_sessions" ON public.workout_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workout_sessions_user_idx ON public.workout_sessions (user_id, session_date DESC);

CREATE TABLE public.workout_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  series INTEGER NOT NULL DEFAULT 0,
  progress_date DATE NOT NULL DEFAULT (now()::date),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weights JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, plan_id, day_key, exercise_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_progress TO authenticated;
GRANT ALL ON public.workout_progress TO service_role;
ALTER TABLE public.workout_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_progress" ON public.workout_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER workout_progress_touch BEFORE UPDATE ON public.workout_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 20260708130000: assistant agent ============
CREATE TABLE public.user_health_intake (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_health_intake TO authenticated;
GRANT ALL ON public.user_health_intake TO service_role;
ALTER TABLE public.user_health_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health_intake" ON public.user_health_intake
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_health_intake_touch BEFORE UPDATE ON public.user_health_intake
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assistant_messages" ON public.assistant_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX assistant_messages_user_idx ON public.assistant_messages (user_id, created_at);

-- ============ 20260708150000: circulo (group_posts + ranking) ============
CREATE TABLE public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Viajante',
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'post',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.group_posts TO authenticated;
GRANT ALL ON public.group_posts TO service_role;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read group_posts" ON public.group_posts FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "member posts to group" ON public.group_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "author deletes own post" ON public.group_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX group_posts_idx ON public.group_posts (group_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.group_weekly_ranking(_group_id UUID)
RETURNS TABLE (user_id UUID, display_name TEXT, sessions BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_group_member(_group_id, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT gm.user_id, p.display_name, COUNT(ws.id) AS sessions
    FROM public.group_members gm
    JOIN public.profiles p ON p.id = gm.user_id
    LEFT JOIN public.workout_sessions ws
      ON ws.user_id = gm.user_id
      AND ws.session_date >= date_trunc('week', now())::date
    WHERE gm.group_id = _group_id
    GROUP BY gm.user_id, p.display_name
    ORDER BY sessions DESC, p.display_name ASC;
END $$;
REVOKE EXECUTE ON FUNCTION public.group_weekly_ranking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_weekly_ranking(UUID) TO authenticated;
