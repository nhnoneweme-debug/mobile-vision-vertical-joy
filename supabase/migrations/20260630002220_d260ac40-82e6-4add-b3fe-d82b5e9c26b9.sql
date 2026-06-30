
-- =========== wake_alarms ===========
CREATE TABLE public.wake_alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Despertar',
  time_local TIME NOT NULL,
  days_of_week INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  wake_style TEXT NOT NULL DEFAULT 'gentle' CHECK (wake_style IN ('gentle','firm','energetic','custom')),
  voice_persona TEXT NOT NULL DEFAULT 'orientador',
  max_snoozes INT NOT NULL DEFAULT 3,
  snooze_strategy TEXT NOT NULL DEFAULT 'adaptive' CHECK (snooze_strategy IN ('fixed','adaptive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wake_alarms TO authenticated;
GRANT ALL ON public.wake_alarms TO service_role;
ALTER TABLE public.wake_alarms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_alarms" ON public.wake_alarms FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_wake_alarms BEFORE UPDATE ON public.wake_alarms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== wake_sessions ===========
CREATE TABLE public.wake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alarm_id UUID REFERENCES public.wake_alarms(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  woke_at TIMESTAMPTZ,
  total_snooze_min INT NOT NULL DEFAULT 0,
  snooze_count INT NOT NULL DEFAULT 0,
  mood_on_wake TEXT,
  dream_logged BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','snoozing','awake','missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wake_sessions TO authenticated;
GRANT ALL ON public.wake_sessions TO service_role;
ALTER TABLE public.wake_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions" ON public.wake_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========== wake_events ===========
CREATE TABLE public.wake_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.wake_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ring','snooze','interaction','music','thought','wake','miss')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wake_events TO authenticated;
GRANT ALL ON public.wake_events TO service_role;
ALTER TABLE public.wake_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_wake_events_select" ON public.wake_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_wake_events_insert" ON public.wake_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========== dream_logs ===========
CREATE TABLE public.dream_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.wake_sessions(id) ON DELETE SET NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_text TEXT,
  audio_url TEXT,
  mood TEXT,
  lucidity INT CHECK (lucidity BETWEEN 0 AND 10),
  symbols TEXT[] NOT NULL DEFAULT '{}',
  themes TEXT[] NOT NULL DEFAULT '{}',
  ai_summary TEXT,
  ai_interpretation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dream_logs TO authenticated;
GRANT ALL ON public.dream_logs TO service_role;
ALTER TABLE public.dream_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_dreams" ON public.dream_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========== day_blocks ===========
CREATE TABLE public.day_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  kind TEXT NOT NULL CHECK (kind IN ('wake','dream','kitchen','move','deep_work','family','wind_down','sleep')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_blocks TO authenticated;
GRANT ALL ON public.day_blocks TO service_role;
ALTER TABLE public.day_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_day_blocks" ON public.day_blocks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX day_blocks_user_date_idx ON public.day_blocks(user_id, date);

-- =========== sleep_logs ===========
CREATE TABLE public.sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  bed_at TIMESTAMPTZ,
  sleep_at TIMESTAMPTZ,
  wake_at TIMESTAMPTZ,
  quality INT CHECK (quality BETWEEN 1 AND 5),
  ritual_done BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_logs TO authenticated;
GRANT ALL ON public.sleep_logs TO service_role;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sleep_logs" ON public.sleep_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
