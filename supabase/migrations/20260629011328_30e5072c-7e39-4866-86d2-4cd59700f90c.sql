-- Etapa 5.2 — Calendário + Planejamento estratégico

-- Metas trimestrais
CREATE TABLE public.strategic_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  area_slug TEXT,
  quarter TEXT NOT NULL, -- e.g. "2026-Q3"
  target_value INT DEFAULT 1,
  current_value INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active|completed|abandoned
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategic_goals TO authenticated;
GRANT ALL ON public.strategic_goals TO service_role;

ALTER TABLE public.strategic_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own strategic goals" ON public.strategic_goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_strategic_goals_user_quarter ON public.strategic_goals(user_id, quarter);

CREATE TRIGGER touch_strategic_goals_updated_at
  BEFORE UPDATE ON public.strategic_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Quests agendadas (planejamento futuro)
CREATE TABLE public.scheduled_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  area_slug TEXT,
  goal_id UUID REFERENCES public.strategic_goals(id) ON DELETE SET NULL,
  xp_reward INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'planned', -- planned|done|skipped
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_quests TO authenticated;
GRANT ALL ON public.scheduled_quests TO service_role;

ALTER TABLE public.scheduled_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own scheduled quests" ON public.scheduled_quests
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_scheduled_quests_user_date ON public.scheduled_quests(user_id, scheduled_date);

CREATE TRIGGER touch_scheduled_quests_updated_at
  BEFORE UPDATE ON public.scheduled_quests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Função: retorna heatmap de atividade (XP por dia) num intervalo
CREATE OR REPLACE FUNCTION public.calendar_activity(_start DATE, _end DATE)
RETURNS TABLE(day DATE, xp INT, events INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (created_at AT TIME ZONE 'UTC')::DATE AS day,
    COALESCE(SUM(amount), 0)::INT AS xp,
    COUNT(*)::INT AS events
  FROM public.xp_events
  WHERE user_id = auth.uid()
    AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN _start AND _end
  GROUP BY day
  ORDER BY day;
$$;

REVOKE EXECUTE ON FUNCTION public.calendar_activity(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_activity(DATE, DATE) TO authenticated;