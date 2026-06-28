
-- HABITS
CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  icon text NOT NULL DEFAULT 'flame',
  area_slug text NOT NULL DEFAULT 'corpo',
  target_per_week integer NOT NULL DEFAULT 7,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own habits" ON public.habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own habits" ON public.habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own habits" ON public.habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own habits" ON public.habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER habits_updated_at BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();

-- HABIT LOGS
CREATE TABLE public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed',
  xp_reward integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);

GRANT SELECT, INSERT, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own habit logs" ON public.habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own habit logs" ON public.habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own habit logs" ON public.habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Award XP on habit log
CREATE OR REPLACE FUNCTION public.award_habit_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    INSERT INTO public.xp_events (user_id, source, amount, ref_id)
    VALUES (NEW.user_id, 'habit', NEW.xp_reward, NEW.id);

    UPDATE public.profiles
    SET xp = xp + NEW.xp_reward,
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER habit_logs_award_xp AFTER INSERT ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.award_habit_xp();

-- Remove XP on undo
CREATE OR REPLACE FUNCTION public.remove_habit_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xp_events WHERE ref_id = OLD.id AND source = 'habit';
  UPDATE public.profiles
  SET xp = GREATEST(0, xp - OLD.xp_reward),
      updated_at = now()
  WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER habit_logs_remove_xp AFTER DELETE ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.remove_habit_xp();

-- Habit streak (consecutive days ending today or yesterday)
CREATE OR REPLACE FUNCTION public.habit_streak(_habit_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s integer := 0;
  d date := CURRENT_DATE;
  has_today boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.habit_logs WHERE habit_id = _habit_id AND log_date = CURRENT_DATE) INTO has_today;
  IF NOT has_today THEN
    d := CURRENT_DATE - 1;
  END IF;
  LOOP
    IF EXISTS(SELECT 1 FROM public.habit_logs WHERE habit_id = _habit_id AND log_date = d) THEN
      s := s + 1;
      d := d - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.habit_streak(uuid) TO authenticated;
