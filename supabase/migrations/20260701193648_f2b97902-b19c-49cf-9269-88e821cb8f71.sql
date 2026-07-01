-- Fase 1: Missões editáveis com agenda e lembrete
CREATE TABLE public.user_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  area_slug TEXT,
  mission_type TEXT NOT NULL DEFAULT 'daily' CHECK (mission_type IN ('daily','weekly','one_off')),
  scheduled_time TIME,
  weekday_mask INT DEFAULT 127 CHECK (weekday_mask BETWEEN 0 AND 127),
  remind_before_min INT NOT NULL DEFAULT 0 CHECK (remind_before_min BETWEEN 0 AND 240),
  xp_reward INT NOT NULL DEFAULT 15 CHECK (xp_reward BETWEEN 0 AND 200),
  active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_missions_user_active_idx ON public.user_missions(user_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own missions read"   ON public.user_missions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own missions insert" ON public.user_missions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own missions update" ON public.user_missions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own missions delete" ON public.user_missions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_missions_touch BEFORE UPDATE ON public.user_missions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Logs de conclusão por dia
CREATE TABLE public.user_mission_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id UUID NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  done BOOLEAN NOT NULL DEFAULT true,
  done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, log_date)
);
CREATE INDEX user_mission_logs_user_date_idx ON public.user_mission_logs(user_id, log_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mission_logs TO authenticated;
GRANT ALL ON public.user_mission_logs TO service_role;

ALTER TABLE public.user_mission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own mission logs read"   ON public.user_mission_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mission logs insert" ON public.user_mission_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mission logs update" ON public.user_mission_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mission logs delete" ON public.user_mission_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger para conceder XP quando marca como feito
CREATE OR REPLACE FUNCTION public.award_user_mission_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reward INT;
BEGIN
  IF NEW.done = true THEN
    SELECT xp_reward INTO v_reward FROM public.user_missions WHERE id = NEW.mission_id;
    IF v_reward IS NULL THEN v_reward := 15; END IF;
    INSERT INTO public.xp_events (user_id, amount, source, ref_id, meta)
    VALUES (NEW.user_id, v_reward, 'user_mission', NEW.mission_id,
            jsonb_build_object('log_date', NEW.log_date));
    UPDATE public.profiles SET xp = xp + v_reward, updated_at = now() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_user_mission_log_xp
  AFTER INSERT ON public.user_mission_logs
  FOR EACH ROW EXECUTE FUNCTION public.award_user_mission_xp();
