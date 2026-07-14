
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS winner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

CREATE TABLE public.challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  workout_session_id uuid REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  note text,
  photo_url text,
  points int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, checkin_date)
);
GRANT SELECT, INSERT, DELETE ON public.challenge_checkins TO authenticated;
GRANT ALL ON public.challenge_checkins TO service_role;
ALTER TABLE public.challenge_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view checkins"
  ON public.challenge_checkins FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.challenges c
                 WHERE c.id = challenge_id
                   AND public.is_group_member(c.group_id, auth.uid())));

CREATE POLICY "Users insert own checkins"
  ON public.challenge_checkins FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.challenges c
                WHERE c.id = challenge_id
                  AND public.is_group_member(c.group_id, auth.uid()))
  );

CREATE POLICY "Users delete own checkins"
  ON public.challenge_checkins FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX challenge_checkins_challenge_user_idx
  ON public.challenge_checkins(challenge_id, user_id, checkin_date DESC);

CREATE OR REPLACE FUNCTION public.validate_challenge_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c RECORD;
BEGIN
  SELECT starts_at, ends_at, group_id INTO c FROM public.challenges WHERE id = NEW.challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF NEW.checkin_date < c.starts_at::date OR NEW.checkin_date > c.ends_at::date THEN
    RAISE EXCEPTION 'checkin_outside_window';
  END IF;
  IF NEW.workout_session_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.workout_sessions ws
                   WHERE ws.id = NEW.workout_session_id AND ws.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'workout_not_owned';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_challenge_checkin
  BEFORE INSERT ON public.challenge_checkins
  FOR EACH ROW EXECUTE FUNCTION public.validate_challenge_checkin();

CREATE UNIQUE INDEX IF NOT EXISTS challenge_progress_unique
  ON public.challenge_progress(challenge_id, user_id);

CREATE OR REPLACE FUNCTION public.recalc_challenge_progress(_challenge uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_metric text; v_value int;
BEGIN
  SELECT metric INTO v_metric FROM public.challenges WHERE id = _challenge;
  IF v_metric IS NULL THEN RETURN; END IF;

  IF v_metric = 'minutos' THEN
    SELECT COALESCE(SUM(ws.duration_sec)/60, 0)::int INTO v_value
      FROM public.challenge_checkins cc
      LEFT JOIN public.workout_sessions ws ON ws.id = cc.workout_session_id
      WHERE cc.challenge_id = _challenge AND cc.user_id = _user;
  ELSIF v_metric = 'treinos' THEN
    SELECT COUNT(*)::int INTO v_value FROM public.challenge_checkins
      WHERE challenge_id = _challenge AND user_id = _user AND workout_session_id IS NOT NULL;
  ELSE
    SELECT COUNT(*)::int INTO v_value FROM public.challenge_checkins
      WHERE challenge_id = _challenge AND user_id = _user;
  END IF;

  INSERT INTO public.challenge_progress (challenge_id, user_id, value, updated_at)
  VALUES (_challenge, _user, v_value, now())
  ON CONFLICT (challenge_id, user_id)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.trg_checkin_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_challenge_progress(OLD.challenge_id, OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_challenge_progress(NEW.challenge_id, NEW.user_id);
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER trg_challenge_checkin_recalc
  AFTER INSERT OR DELETE ON public.challenge_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkin_recalc();

CREATE OR REPLACE FUNCTION public.trg_checkin_group_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_group uuid; v_title text; v_name text; v_nth int;
BEGIN
  SELECT c.group_id, c.title INTO v_group, v_title FROM public.challenges c WHERE c.id = NEW.challenge_id;
  IF v_group IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, 'Viajante') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT COUNT(*) INTO v_nth FROM public.challenge_checkins
    WHERE challenge_id = NEW.challenge_id AND user_id = NEW.user_id;
  BEGIN
    INSERT INTO public.group_posts (group_id, user_id, author_name, content, kind)
    VALUES (v_group, NEW.user_id, COALESCE(v_name, 'Viajante'),
            v_name || ' treinou hoje 💪 — ' || v_nth || 'º dia · ' || v_title
              || COALESCE(E'\nfoto: ' || NEW.photo_url, ''),
            'treino');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_challenge_checkin_post
  AFTER INSERT ON public.challenge_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkin_group_post();

CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_challenge uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, value int, rank int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_group uuid;
BEGIN
  SELECT group_id INTO v_group FROM public.challenges WHERE id = _challenge;
  IF v_group IS NULL OR NOT public.is_group_member(v_group, auth.uid()) THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, COALESCE(p.display_name, 'Viajante'), p.avatar_url,
           COALESCE(cp.value, 0)::int,
           ROW_NUMBER() OVER (ORDER BY COALESCE(cp.value,0) DESC, p.display_name ASC)::int
      FROM public.group_members gm
      JOIN public.profiles p ON p.id = gm.user_id
      LEFT JOIN public.challenge_progress cp
             ON cp.challenge_id = _challenge AND cp.user_id = gm.user_id
     WHERE gm.group_id = v_group
     ORDER BY 4 DESC, 2 ASC;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_calendar(_challenge uuid, _month date)
RETURNS TABLE(user_id uuid, display_name text, checkin_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_group uuid; v_start date; v_end date;
BEGIN
  SELECT group_id INTO v_group FROM public.challenges WHERE id = _challenge;
  IF v_group IS NULL OR NOT public.is_group_member(v_group, auth.uid()) THEN RETURN; END IF;
  v_start := date_trunc('month', _month)::date;
  v_end := (v_start + INTERVAL '1 month')::date;
  RETURN QUERY
    SELECT cc.user_id, COALESCE(p.display_name, 'Viajante'), cc.checkin_date
      FROM public.challenge_checkins cc
      JOIN public.profiles p ON p.id = cc.user_id
     WHERE cc.challenge_id = _challenge
       AND cc.checkin_date >= v_start
       AND cc.checkin_date < v_end
     ORDER BY cc.checkin_date;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_challenge(_challenge uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c RECORD; v_winner uuid; r RECORD;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _challenge;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF c.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'winner', c.winner_user_id);
  END IF;
  IF c.ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_yet_ended');
  END IF;

  SELECT user_id INTO v_winner FROM public.challenge_progress
    WHERE challenge_id = _challenge AND value > 0
    ORDER BY value DESC LIMIT 1;

  UPDATE public.challenges SET winner_user_id = v_winner, finalized_at = now() WHERE id = _challenge;

  IF v_winner IS NOT NULL THEN
    INSERT INTO public.xp_events (user_id, amount, source, ref_id, meta)
    VALUES (v_winner, 100, 'challenge_win', _challenge,
            jsonb_build_object('title', c.title, 'group_id', c.group_id));
    UPDATE public.profiles SET xp = xp + 100 WHERE id = v_winner;
  END IF;

  FOR r IN SELECT DISTINCT user_id FROM public.challenge_checkins WHERE challenge_id = _challenge LOOP
    IF v_winner IS NULL OR r.user_id <> v_winner THEN
      INSERT INTO public.xp_events (user_id, amount, source, ref_id, meta)
      VALUES (r.user_id, 25, 'challenge_participation', _challenge,
              jsonb_build_object('title', c.title));
      UPDATE public.profiles SET xp = xp + 25 WHERE id = r.user_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'winner', v_winner);
END $$;

REVOKE EXECUTE ON FUNCTION public.finalize_challenge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_calendar(uuid, date) TO authenticated;
