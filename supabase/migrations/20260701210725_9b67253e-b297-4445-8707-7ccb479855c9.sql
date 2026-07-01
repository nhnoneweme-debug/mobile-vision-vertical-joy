
CREATE OR REPLACE FUNCTION public.generate_nudges_for(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_now TIMESTAMPTZ := now();
  v_inserted INT := 0;
  v_streak INT;
  v_last_activity DATE;
  r RECORD;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  -- 1) Missões pendentes com horário atingido
  FOR r IN
    SELECT m.id, m.title, m.remind_at
    FROM public.user_missions m
    LEFT JOIN public.user_mission_logs l
      ON l.mission_id = m.id AND l.user_id = _user_id AND l.log_date = v_today AND l.done = true
    WHERE m.user_id = _user_id
      AND m.active = true
      AND l.id IS NULL
      AND m.remind_at IS NOT NULL
      AND m.remind_at::time <= v_now::time
      AND (m.weekday_mask IS NULL OR (m.weekday_mask & (1 << EXTRACT(DOW FROM v_today)::INT)) > 0)
  LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, link, ref_id, dedupe_key)
    VALUES (_user_id, 'mission_due',
      'Missão pendente: ' || r.title,
      COALESCE('Agendada para ' || to_char(r.remind_at::time, 'HH24:MI'), 'Você marcou para hoje'),
      '/missoes', r.id,
      'mission_due:' || r.id::text || ':' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  -- 2) Streak em risco
  SELECT COALESCE(streak, 0) INTO v_streak FROM public.profiles WHERE id = _user_id;
  SELECT MAX((created_at AT TIME ZONE 'UTC')::date) INTO v_last_activity
    FROM public.xp_events WHERE user_id = _user_id;

  IF v_streak >= 2 AND v_last_activity = v_today - 1 THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (_user_id, 'streak_risk',
      'Sua brasa de ' || v_streak || ' dias está em risco',
      'Marque uma missão ou ritual hoje para manter a chama viva.',
      '/missoes',
      'streak_risk:' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  -- 3) Ritual noturno após 21h
  IF v_now::time >= TIME '21:00'
     AND NOT EXISTS (SELECT 1 FROM public.ritual_logs
                     WHERE user_id = _user_id AND ritual_type = 'night' AND ritual_date = v_today) THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (_user_id, 'night_ritual',
      'Ritual noturno esperando',
      'Fechar o dia com intenção prepara amanhã. Vamos?',
      '/dormir',
      'night_ritual:' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  -- 4) Ritual matinal antes das 11h
  IF v_now::time <= TIME '11:00'
     AND NOT EXISTS (SELECT 1 FROM public.ritual_logs
                     WHERE user_id = _user_id AND ritual_type = 'morning' AND ritual_date = v_today) THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (_user_id, 'morning_ritual',
      'Ritual matinal disponível',
      'Um clique acorda a intenção do dia.',
      '/despertar',
      'morning_ritual:' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  -- 5) Missões pendentes do orientador
  FOR r IN
    SELECT id, title FROM public.orientador_missions
     WHERE student_id = _user_id AND status = 'pending'
  LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, link, ref_id, dedupe_key)
    VALUES (_user_id, 'orientador_mission',
      'Missão do orientador: ' || r.title,
      'Seu orientador te enviou uma missão personalizada.',
      '/jornada', r.id,
      'orient_mission:' || r.id::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_nudges_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_nudges_for(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_nudges_all_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  users_count INT := 0;
  total_nudges INT := 0;
  n INT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE onboarding_complete = true LOOP
    n := public.generate_nudges_for(r.id);
    users_count := users_count + 1;
    total_nudges := total_nudges + COALESCE(n, 0);
  END LOOP;
  RETURN jsonb_build_object('users', users_count, 'nudges', total_nudges, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.generate_nudges_all_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_nudges_all_users() TO service_role;
