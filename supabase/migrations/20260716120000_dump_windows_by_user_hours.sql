-- Dump de sonho (manhã) e do dia (noite) nos horários que a PESSOA definiu.
--
-- Antes: generate_nudges_for usava horas fixas em UTC ('>= 21:00' / '<= 11:00'),
-- ignorando notification_prefs.morning_hour/night_hour — quem acorda 5h ou mora
-- fora do fuso do servidor recebia o empurrão na hora errada.
--
-- Agora: a janela abre no horário do usuário, no fuso do usuário, e dura algumas
-- horas (quem acorda 7h e abre o app 8h30 ainda quer registrar o sonho).
-- Espelha src/lib/dump.ts — MORNING_WINDOW_H=3, NIGHT_WINDOW_H=4.

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

COMMENT ON COLUMN public.notification_prefs.timezone IS
  'IANA timezone do usuário (Intl.DateTimeFormat().resolvedOptions().timeZone). Base para as janelas de dump.';

CREATE OR REPLACE FUNCTION public.generate_nudges_for(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_now TIMESTAMPTZ := now();
  v_inserted INT := 0;
  v_streak INT;
  v_last_activity DATE;
  r RECORD;
  -- janelas de dump
  v_morning_hour INT;
  v_night_hour INT;
  v_tz TEXT;
  v_local TIMESTAMP;
  v_local_date DATE;
  v_hour NUMERIC;
  v_since_morning NUMERIC;
  v_since_night NUMERIC;
  v_night_date DATE;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT m.id, m.title, m.scheduled_time
    FROM public.user_missions m
    LEFT JOIN public.user_mission_logs l
      ON l.mission_id = m.id AND l.user_id = _user_id AND l.log_date = v_today AND l.done = true
    WHERE m.user_id = _user_id
      AND m.active = true
      AND l.id IS NULL
      AND m.scheduled_time IS NOT NULL
      AND m.scheduled_time <= v_now::time
      AND (m.weekday_mask IS NULL OR (m.weekday_mask & (1 << EXTRACT(DOW FROM v_today)::INT)) > 0)
  LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, link, ref_id, dedupe_key)
    VALUES (_user_id, 'mission_due',
      'Missão pendente: ' || r.title,
      COALESCE('Agendada para ' || to_char(r.scheduled_time, 'HH24:MI'), 'Você marcou para hoje'),
      '/missoes', r.id,
      'mission_due:' || r.id::text || ':' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

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

  -- ---- Janelas de dump, no fuso e nos horários do usuário ----
  SELECT np.morning_hour, np.night_hour, COALESCE(NULLIF(np.timezone, ''), 'America/Sao_Paulo')
    INTO v_morning_hour, v_night_hour, v_tz
    FROM public.notification_prefs np
   WHERE np.user_id = _user_id;

  IF NOT FOUND THEN
    v_morning_hour := 7; v_night_hour := 22; v_tz := 'America/Sao_Paulo';
  END IF;

  -- Fuso inválido derruba o AT TIME ZONE e mataria os nudges do usuário inteiro.
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_tz) THEN
    v_tz := 'America/Sao_Paulo';
  END IF;

  v_local := v_now AT TIME ZONE v_tz;
  v_local_date := v_local::date;
  v_hour := EXTRACT(HOUR FROM v_local) + EXTRACT(MINUTE FROM v_local) / 60.0;

  -- Horas desde a abertura de cada janela, ciclando em 24h.
  v_since_morning := MOD((v_hour - v_morning_hour + 24)::numeric, 24);
  v_since_night := MOD((v_hour - v_night_hour + 24)::numeric, 24);

  IF v_since_morning < 3
     AND NOT EXISTS (SELECT 1 FROM public.ritual_logs
                     WHERE user_id = _user_id AND ritual_type = 'morning' AND ritual_date = v_local_date) THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (_user_id, 'morning_ritual',
      'Bom dia — o que você sonhou?',
      'Fala enquanto lembra, a IA organiza o resto.',
      '/despertar',
      'morning_ritual:' || v_local_date::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  IF v_since_night < 4 THEN
    -- Depois da meia-noite o dump ainda é sobre o dia que acabou.
    v_night_date := CASE WHEN v_hour < v_night_hour THEN v_local_date - 1 ELSE v_local_date END;
    IF NOT EXISTS (SELECT 1 FROM public.ritual_logs
                   WHERE user_id = _user_id AND ritual_type = 'night' AND ritual_date = v_night_date) THEN
      INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
      VALUES (_user_id, 'night_ritual',
        'Hora de fechar o dia',
        'Dump cru do que rolou. A IA organiza e registra.',
        '/dormir',
        'night_ritual:' || v_night_date::text)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN v_inserted := v_inserted + 1; END IF;
    END IF;
  END IF;

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
$function$;
