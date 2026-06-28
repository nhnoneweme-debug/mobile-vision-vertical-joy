
-- notification_prefs
CREATE TABLE public.notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  morning_hour SMALLINT NOT NULL DEFAULT 7 CHECK (morning_hour BETWEEN 0 AND 23),
  night_hour SMALLINT NOT NULL DEFAULT 22 CHECK (night_hour BETWEEN 0 AND 23),
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs" ON public.notification_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ritual_logs: 1 por (user, date, type)
CREATE TABLE public.ritual_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ritual_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  ritual_type TEXT NOT NULL CHECK (ritual_type IN ('morning','night')),
  intention TEXT,
  reflections JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ritual_date, ritual_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ritual_logs TO authenticated;
GRANT ALL ON public.ritual_logs TO service_role;
ALTER TABLE public.ritual_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rituals" ON public.ritual_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER notification_prefs_updated BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ritual_logs_updated BEFORE UPDATE ON public.ritual_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- award +25 XP on ritual completion (once per type per day)
CREATE OR REPLACE FUNCTION public.award_ritual_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.xp_events (user_id, amount, source, meta)
  VALUES (NEW.user_id, 25, 'ritual_' || NEW.ritual_type,
          jsonb_build_object('ritual_date', NEW.ritual_date));
  UPDATE public.profiles SET xp = xp + 25 WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER ritual_xp_on_insert AFTER INSERT ON public.ritual_logs
  FOR EACH ROW EXECUTE FUNCTION public.award_ritual_xp();
