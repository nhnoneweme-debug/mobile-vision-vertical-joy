-- Lock compute function to auth.uid()
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
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(xp,0), COALESCE(streak,0) INTO v_xp, v_streak
  FROM public.profiles WHERE id = _user_id;

  SELECT COALESCE(AVG(LEAST(xp, 1000)), 0) INTO v_area_avg
  FROM public.area_progress WHERE user_id = _user_id;

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

  xp_score     := LEAST(300, (v_xp * 300) / 5000);
  area_score   := LEAST(250, (v_area_avg::INT * 250) / 1000);
  habit_score  := LEAST(250, (LEAST(v_habit_rate, 1.0) * 250)::INT);
  streak_score := LEAST(200, v_streak * 10);
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

-- Revoke snapshot function from everyone except service_role
REVOKE EXECUTE ON FUNCTION public.save_weekly_score_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_weekly_score_snapshot() TO service_role;