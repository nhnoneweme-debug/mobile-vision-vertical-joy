
CREATE OR REPLACE FUNCTION public.orientador_student_snapshot(_student uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_linked boolean;
  v_profile jsonb;
  v_area jsonb;
  v_xp_daily jsonb;
  v_missions_recent jsonb;
  v_habits jsonb;
  v_rituals jsonb;
  v_sleep jsonb;
  v_mood jsonb;
  v_since date := CURRENT_DATE - INTERVAL '30 days';
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.orientador_students
    WHERE orientador_id = v_caller
      AND student_id = _student
      AND status = 'active'
  ) INTO v_linked;

  IF NOT v_linked THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT to_jsonb(p) INTO v_profile FROM (
    SELECT id, display_name, behavioral_class, xp, streak, brasas,
           avatar_url, gender_track, onboarding_complete
    FROM public.profiles WHERE id = _student
  ) p;

  SELECT COALESCE(jsonb_agg(a ORDER BY a.xp DESC), '[]'::jsonb) INTO v_area FROM (
    SELECT area_slug, xp, level FROM public.area_progress WHERE user_id = _student
  ) a;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.day), '[]'::jsonb) INTO v_xp_daily FROM (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
           SUM(amount)::int AS xp,
           COUNT(*)::int AS events
    FROM public.xp_events
    WHERE user_id = _student
      AND (created_at AT TIME ZONE 'UTC')::date >= v_since
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(m ORDER BY m.created_at DESC), '[]'::jsonb) INTO v_missions_recent FROM (
    SELECT id, title, status, xp_reward, due_at, created_at, completed_at, area_slug
    FROM public.orientador_missions
    WHERE student_id = _student AND orientador_id = v_caller
    ORDER BY created_at DESC LIMIT 20
  ) m;

  SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) INTO v_habits FROM (
    SELECT h.id, h.title, h.target_per_week, h.active,
           (SELECT COUNT(*) FROM public.habit_logs hl
             WHERE hl.habit_id = h.id AND hl.log_date >= v_since) AS logs_30d
    FROM public.habits h WHERE h.user_id = _student
  ) h;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.ritual_date DESC), '[]'::jsonb) INTO v_rituals FROM (
    SELECT ritual_date, ritual_type
    FROM public.ritual_logs
    WHERE user_id = _student AND ritual_date >= v_since
    LIMIT 100
  ) r;

  SELECT COALESCE(jsonb_agg(s ORDER BY s.log_date DESC), '[]'::jsonb) INTO v_sleep FROM (
    SELECT log_date, hours, quality, mood
    FROM public.sleep_logs
    WHERE user_id = _student AND log_date >= v_since
    LIMIT 60
  ) s;

  SELECT COALESCE(jsonb_agg(j ORDER BY j.log_date DESC), '[]'::jsonb) INTO v_mood FROM (
    SELECT log_date, mood_score, tags
    FROM public.mental_journal
    WHERE user_id = _student AND log_date >= v_since
    LIMIT 60
  ) j;

  RETURN jsonb_build_object(
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'areas', v_area,
    'xp_daily', v_xp_daily,
    'missions', v_missions_recent,
    'habits', v_habits,
    'rituals', v_rituals,
    'sleep', v_sleep,
    'mood', v_mood,
    'window_days', 30,
    'generated_at', now()
  );
END $$;

REVOKE ALL ON FUNCTION public.orientador_student_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orientador_student_snapshot(uuid) TO authenticated;
