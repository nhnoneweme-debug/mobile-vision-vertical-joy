
-- daily_quests
CREATE TABLE public.daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_date date NOT NULL DEFAULT CURRENT_DATE,
  area_slug text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL,
  xp_reward int NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  effort int,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_quests TO authenticated;
GRANT ALL ON public.daily_quests TO service_role;

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own quests" ON public.daily_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own quests" ON public.daily_quests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own quests" ON public.daily_quests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own quests" ON public.daily_quests FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_daily_quests_updated_at
BEFORE UPDATE ON public.daily_quests
FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();

-- xp_events
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  amount int NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own xp" ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own xp" ON public.xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_xp_events_user_created ON public.xp_events (user_id, created_at DESC);

-- award_quest_xp trigger
CREATE OR REPLACE FUNCTION public.award_quest_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_completed date;
  new_streak int;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- log xp event
    INSERT INTO public.xp_events (user_id, source, amount, ref_id)
    VALUES (NEW.user_id, 'quest', NEW.xp_reward, NEW.id);

    -- compute streak: look for previous completed quest before this one
    SELECT MAX(quest_date) INTO last_completed
    FROM public.daily_quests
    WHERE user_id = NEW.user_id
      AND status = 'completed'
      AND id <> NEW.id
      AND quest_date < NEW.quest_date;

    IF last_completed = NEW.quest_date - INTERVAL '1 day' THEN
      SELECT streak + 1 INTO new_streak FROM public.profiles WHERE id = NEW.user_id;
    ELSE
      new_streak := 1;
    END IF;

    UPDATE public.profiles
    SET xp = xp + NEW.xp_reward,
        streak = new_streak,
        updated_at = now()
    WHERE id = NEW.user_id;

    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_quest_xp
BEFORE UPDATE ON public.daily_quests
FOR EACH ROW EXECUTE FUNCTION public.award_quest_xp();
