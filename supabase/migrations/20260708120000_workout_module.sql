-- Módulo de Treino: planos, sessões (histórico) e progresso ao vivo (cross-device).
-- RLS: cada usuário só acessa os próprios registros (auth.uid() = user_id).

-- ============================================================
-- 1) Planos de treino
-- days (jsonb): [{ "dia": "A", "foco": "Peito+tríceps", "nota": "",
--                  "exercicios": [{ "id":"uuid", "nome":"Supino", "series":4, "reps":"8-12", "nota":"" }] }]
-- ============================================================
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Novo treino',
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'ai'
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

-- ============================================================
-- 2) Sessões (histórico de execução)
-- ============================================================
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

-- ============================================================
-- 3) Progresso ao vivo (cross-device). Reset diário via progress_date.
--    Uma linha por (usuário, plano, dia, exercício).
-- ============================================================
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
