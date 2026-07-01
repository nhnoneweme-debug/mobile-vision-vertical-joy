
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  ref_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_key TEXT
);

CREATE UNIQUE INDEX notifications_dedupe_idx
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_user_unread_idx
  ON public.notifications(user_id, read_at, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Função para gerar notificações do próprio usuário (executada no client via RPC).
CREATE OR REPLACE FUNCTION public.generate_my_nudges()
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_today DATE := CURRENT_DATE;
  v_now TIMESTAMPTZ := now();
  v_inserted INT := 0;
  v_streak INT;
  v_last_activity DATE;
  r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  -- 1) Missões agendadas para hoje já com horário atingido e ainda não feitas
  FOR r IN
    SELECT m.id, m.title, m.remind_at, m.area_slug
    FROM public.user_missions m
    LEFT JOIN public.user_mission_logs l
      ON l.mission_id = m.id AND l.user_id = v_user AND l.log_date = v_today AND l.done = true
    WHERE m.user_id = v_user
      AND m.active = true
      AND l.id IS NULL
      AND m.remind_at IS NOT NULL
      AND m.remind_at::time <= v_now::time
      AND (m.weekday_mask IS NULL OR (m.weekday_mask & (1 << EXTRACT(DOW FROM v_today)::INT)) > 0)
  LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, link, ref_id, dedupe_key)
    VALUES (v_user, 'mission_due',
      'Missão pendente: ' || r.title,
      COALESCE('Agendada para ' || to_char(r.remind_at::time, 'HH24:MI'), 'Você marcou para hoje'),
      '/missoes', r.id,
      'mission_due:' || r.id::text || ':' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  -- 2) Streak em risco: tem streak >= 2, última atividade foi ontem, ainda nada hoje
  SELECT COALESCE(streak, 0) INTO v_streak FROM public.profiles WHERE id = v_user;
  SELECT MAX((created_at AT TIME ZONE 'UTC')::date) INTO v_last_activity
    FROM public.xp_events WHERE user_id = v_user;

  IF v_streak >= 2 AND v_last_activity = v_today - 1 THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (v_user, 'streak_risk',
      'Sua brasa de ' || v_streak || ' dias está em risco',
      'Marque uma missão ou ritual hoje para manter a chama viva.',
      '/missoes',
      'streak_risk:' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  -- 3) Ritual noturno: se passou das 21h e não fez ritual hoje
  IF v_now::time >= TIME '21:00'
     AND NOT EXISTS (SELECT 1 FROM public.ritual_logs
                     WHERE user_id = v_user AND ritual_type = 'night' AND ritual_date = v_today) THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (v_user, 'night_ritual',
      'Ritual noturno esperando',
      'Fechar o dia com intenção prepara amanhã. Vamos?',
      '/dormir',
      'night_ritual:' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  -- 4) Ritual matinal: se antes das 11h e não fez ritual matinal
  IF v_now::time <= TIME '11:00'
     AND NOT EXISTS (SELECT 1 FROM public.ritual_logs
                     WHERE user_id = v_user AND ritual_type = 'morning' AND ritual_date = v_today) THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link, dedupe_key)
    VALUES (v_user, 'morning_ritual',
      'Ritual matinal disponível',
      'Um clique acorda a intenção do dia.',
      '/despertar',
      'morning_ritual:' || v_today::text)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END IF;

  -- 5) Missão do orientador pendente
  FOR r IN
    SELECT id, title FROM public.orientador_missions
     WHERE student_id = v_user AND status = 'pending'
  LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, link, ref_id, dedupe_key)
    VALUES (v_user, 'orientador_mission',
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

GRANT EXECUTE ON FUNCTION public.generate_my_nudges() TO authenticated;
