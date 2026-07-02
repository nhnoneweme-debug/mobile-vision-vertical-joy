
-- 1) wearable_samples
CREATE TABLE public.wearable_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sample_date DATE NOT NULL,
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sample_date, metric, source)
);
CREATE INDEX wearable_samples_user_date_idx ON public.wearable_samples(user_id, sample_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wearable_samples TO authenticated;
GRANT ALL ON public.wearable_samples TO service_role;
ALTER TABLE public.wearable_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wearable samples" ON public.wearable_samples
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER wearable_samples_touch BEFORE UPDATE ON public.wearable_samples
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) wearable_connections
CREATE TABLE public.wearable_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'imported',
  last_sync_at TIMESTAMPTZ,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wearable_connections TO authenticated;
GRANT ALL ON public.wearable_connections TO service_role;
ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wearable connections" ON public.wearable_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER wearable_connections_touch BEFORE UPDATE ON public.wearable_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) wearable_source em sleep_logs
ALTER TABLE public.sleep_logs
  ADD COLUMN IF NOT EXISTS wearable_source TEXT;

-- 4) RPC de importação
CREATE OR REPLACE FUNCTION public.import_wearable_samples(_source TEXT, _samples JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_count INT := 0;
  v_sleep_syncs INT := 0;
  s JSONB;
  v_date DATE;
  v_metric TEXT;
  v_value NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _samples IS NULL OR jsonb_typeof(_samples) <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  FOR s IN SELECT * FROM jsonb_array_elements(_samples) LOOP
    v_date := (s->>'date')::DATE;
    v_metric := s->>'metric';
    v_value := (s->>'value')::NUMERIC;
    IF v_date IS NULL OR v_metric IS NULL OR v_value IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.wearable_samples(user_id, sample_date, metric, value, source, raw)
    VALUES (v_user, v_date, v_metric, v_value, COALESCE(_source, 'manual'), s)
    ON CONFLICT (user_id, sample_date, metric, source)
      DO UPDATE SET value = EXCLUDED.value, raw = EXCLUDED.raw, updated_at = now();
    v_count := v_count + 1;

    -- sincroniza sleep_logs quando aplicável
    IF v_metric = 'sleep_hours' THEN
      INSERT INTO public.sleep_logs(user_id, log_date, hours, wearable_source)
      VALUES (v_user, v_date, v_value, _source)
      ON CONFLICT (user_id, log_date) DO UPDATE
        SET hours = EXCLUDED.hours, wearable_source = EXCLUDED.wearable_source;
      v_sleep_syncs := v_sleep_syncs + 1;
    ELSIF v_metric = 'sleep_quality' THEN
      INSERT INTO public.sleep_logs(user_id, log_date, quality, wearable_source)
      VALUES (v_user, v_date, LEAST(5, GREATEST(1, v_value::INT)), _source)
      ON CONFLICT (user_id, log_date) DO UPDATE
        SET quality = EXCLUDED.quality, wearable_source = EXCLUDED.wearable_source;
    END IF;
  END LOOP;

  INSERT INTO public.wearable_connections(user_id, source, status, last_sync_at, meta)
  VALUES (v_user, COALESCE(_source, 'manual'), 'imported', now(),
          jsonb_build_object('imported', v_count))
  ON CONFLICT (user_id, source) DO UPDATE
    SET last_sync_at = now(), status = 'imported',
        meta = jsonb_build_object('imported', v_count);

  RETURN jsonb_build_object('imported', v_count, 'sleep_synced', v_sleep_syncs);
END $$;

REVOKE ALL ON FUNCTION public.import_wearable_samples(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_wearable_samples(TEXT, JSONB) TO authenticated;
