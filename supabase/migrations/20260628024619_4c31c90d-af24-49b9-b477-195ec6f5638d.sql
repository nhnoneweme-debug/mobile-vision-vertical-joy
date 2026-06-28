-- ============================================================
-- Etapa 4.1 — Personal IA Score
-- ============================================================

CREATE TABLE public.score_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 1000),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_snapshots TO authenticated;
GRANT ALL ON public.score_snapshots TO service_role;

ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own snapshots" ON public.score_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own snapshots" ON public.score_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX score_snapshots_user_week_idx
  ON public.score_snapshots (user_id, week_start DESC);

-- ------------------------------------------------------------
-- Score calculation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_personal_ia_score(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INT := 0;
  v_streak INT := 0;
  v_area_avg NUMERIC := 0;
  v_habit_rate NUMERIC := 0;

  xp_score INT;
  area_score INT;
  habit_score INT;
  streak_score INT;
  total INT;
BEGIN
  -- XP global
  SELECT COALESCE(xp,0), COALESCE(streak,0)
    INTO v_xp, v_streak
  FROM public.profiles WHERE id = _user_id;

  -- Média de XP por área (cap em 1000 = nível 6+)
  SELECT COALESCE(AVG(LEAST(xp, 1000)), 0)
    INTO v_area_avg
  FROM public.area_progress WHERE user_id = _user_id;

  -- Taxa de hábitos cumpridos nos últimos 7 dias
  SELECT COALESCE(
    SUM(CASE WHEN hl.id IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC
      / NULLIF(SUM(h.target_per_week), 0),
    0
  )
  INTO v_habit_rate
  FROM public.habits h
  LEFT JOIN public.habit_logs hl
    ON hl.habit_id = h.id
   AND hl.log_date >= CURRENT_DATE - INTERVAL '7 days'
  WHERE h.user_id = _user_id AND h.active = true;

  -- Componentes (cada um vira 0-300/250/250/200)
  xp_score     := LEAST(300, (v_xp * 300) / 5000);                 -- 5000 XP = max
  area_score   := LEAST(250, (v_area_avg::INT * 250) / 1000);
  habit_score  := LEAST(250, (LEAST(v_habit_rate, 1.0) * 250)::INT);
  streak_score := LEAST(200, v_streak * 10);                       -- 20 dias = max

  total := xp_score + area_score + habit_score + streak_score;

  RETURN jsonb_build_object(
    'score', total,
    'breakdown', jsonb_build_object(
      'xp',     jsonb_build_object('value', v_xp,                'score', xp_score,     'max', 300),
      'areas',  jsonb_build_object('value', ROUND(v_area_avg)::INT, 'score', area_score,   'max', 250),
      'habits', jsonb_build_object('value', ROUND(v_habit_rate * 100)::INT, 'score', habit_score,  'max', 250),
      'streak', jsonb_build_object('value', v_streak,            'score', streak_score, 'max', 200)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_personal_ia_score(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Weekly snapshot job (called by pg_cron later)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_weekly_score_snapshot()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  data JSONB;
  inserted INT := 0;
  wk DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles WHERE onboarding_complete = true
  LOOP
    data := public.compute_personal_ia_score(r.id);
    INSERT INTO public.score_snapshots (user_id, week_start, score, breakdown)
    VALUES (r.id, wk, (data->>'score')::INT, data->'breakdown')
    ON CONFLICT (user_id, week_start)
      DO UPDATE SET score = EXCLUDED.score, breakdown = EXCLUDED.breakdown;
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END;
$$;