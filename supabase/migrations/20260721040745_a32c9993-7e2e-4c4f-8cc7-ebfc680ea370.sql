
-- 1. execution_events: telemetria imutável da jornada
CREATE TABLE public.execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.user_missions(id) ON DELETE SET NULL,
  event_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN (
    'manifest_shown','manifest_ack','mission_done','mission_skipped',
    'mission_extended','mission_started','mission_ended','voice_note','negotiation'
  )),
  phase text CHECK (phase IN ('preEnd','atEnd','preStart')),
  channel text CHECK (channel IN ('foreground','push','voice','manual')),
  latency_ms int,
  delta_min int,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.execution_events TO authenticated;
GRANT ALL ON public.execution_events TO service_role;

ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_events_select" ON public.execution_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_events_insert" ON public.execution_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX execution_events_user_date_idx
  ON public.execution_events (user_id, event_date DESC);
CREATE INDEX execution_events_user_mission_time_idx
  ON public.execution_events (user_id, mission_id, occurred_at DESC);
CREATE INDEX execution_events_user_kind_time_idx
  ON public.execution_events (user_id, kind, occurred_at DESC);

-- 2. execution_sessions: agregado diário por bloco
CREATE TABLE public.execution_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  planned_start_min int,
  planned_end_min int,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  extensions_total_min int NOT NULL DEFAULT 0,
  manifest_count int NOT NULL DEFAULT 0,
  ack_count int NOT NULL DEFAULT 0,
  ack_latency_sum_ms bigint NOT NULL DEFAULT 0,
  avg_ack_latency_ms int,
  outcome text CHECK (outcome IN ('done','skipped','abandoned','in_progress')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, session_date)
);

GRANT SELECT ON public.execution_sessions TO authenticated;
GRANT ALL ON public.execution_sessions TO service_role;

ALTER TABLE public.execution_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions_select" ON public.execution_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX execution_sessions_user_date_idx
  ON public.execution_sessions (user_id, session_date DESC);

-- 3. Trigger de agregação: cada evento atualiza execution_sessions
CREATE OR REPLACE FUNCTION public.aggregate_execution_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outcome text;
  v_actual_start timestamptz;
  v_actual_end timestamptz;
  v_ext int := 0;
  v_manifest int := 0;
  v_ack int := 0;
  v_ack_lat bigint := 0;
BEGIN
  IF NEW.mission_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.kind = 'mission_started' THEN v_actual_start := NEW.occurred_at; END IF;
  IF NEW.kind = 'mission_ended' THEN v_actual_end := NEW.occurred_at; END IF;
  IF NEW.kind = 'mission_done' THEN
    v_outcome := 'done'; v_actual_end := NEW.occurred_at;
  END IF;
  IF NEW.kind = 'mission_skipped' THEN
    v_outcome := 'skipped'; v_actual_end := NEW.occurred_at;
  END IF;
  IF NEW.kind = 'mission_extended' THEN v_ext := COALESCE(NEW.delta_min, 0); END IF;
  IF NEW.kind = 'manifest_shown' THEN v_manifest := 1; END IF;
  IF NEW.kind = 'manifest_ack' THEN
    v_ack := 1; v_ack_lat := COALESCE(NEW.latency_ms, 0);
  END IF;

  INSERT INTO public.execution_sessions (
    user_id, mission_id, session_date,
    actual_start_at, actual_end_at,
    extensions_total_min, manifest_count, ack_count, ack_latency_sum_ms,
    avg_ack_latency_ms, outcome
  ) VALUES (
    NEW.user_id, NEW.mission_id, NEW.event_date,
    v_actual_start, v_actual_end,
    v_ext, v_manifest, v_ack, v_ack_lat,
    CASE WHEN v_ack > 0 THEN v_ack_lat::int ELSE NULL END,
    COALESCE(v_outcome, 'in_progress')
  )
  ON CONFLICT (user_id, mission_id, session_date) DO UPDATE SET
    actual_start_at = COALESCE(public.execution_sessions.actual_start_at, EXCLUDED.actual_start_at),
    actual_end_at = COALESCE(EXCLUDED.actual_end_at, public.execution_sessions.actual_end_at),
    extensions_total_min = public.execution_sessions.extensions_total_min + EXCLUDED.extensions_total_min,
    manifest_count = public.execution_sessions.manifest_count + EXCLUDED.manifest_count,
    ack_count = public.execution_sessions.ack_count + EXCLUDED.ack_count,
    ack_latency_sum_ms = public.execution_sessions.ack_latency_sum_ms + EXCLUDED.ack_latency_sum_ms,
    avg_ack_latency_ms = CASE
      WHEN public.execution_sessions.ack_count + EXCLUDED.ack_count > 0
      THEN ((public.execution_sessions.ack_latency_sum_ms + EXCLUDED.ack_latency_sum_ms)
            / (public.execution_sessions.ack_count + EXCLUDED.ack_count))::int
      ELSE public.execution_sessions.avg_ack_latency_ms
    END,
    outcome = CASE
      WHEN v_outcome IS NOT NULL THEN v_outcome
      ELSE public.execution_sessions.outcome
    END,
    updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_execution_event_aggregate
  AFTER INSERT ON public.execution_events
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_execution_event();

-- 4. RPC: estender missão do dia (soma ao end_time) + registra evento
CREATE OR REPLACE FUNCTION public.extend_mission_today(_mission uuid, _minutes int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_mission RECORD;
  v_new_end time;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _minutes IS NULL OR _minutes = 0 OR _minutes < -240 OR _minutes > 240 THEN
    RAISE EXCEPTION 'invalid_minutes';
  END IF;

  SELECT * INTO v_mission FROM public.user_missions
    WHERE id = _mission AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_not_found'; END IF;

  IF v_mission.end_time IS NULL THEN
    v_new_end := COALESCE(v_mission.scheduled_time, '00:00'::time)
                 + make_interval(mins => 30 + _minutes);
  ELSE
    v_new_end := v_mission.end_time + make_interval(mins => _minutes);
  END IF;

  UPDATE public.user_missions
    SET end_time = v_new_end, updated_at = now()
    WHERE id = _mission;

  INSERT INTO public.execution_events (
    user_id, mission_id, kind, delta_min, channel, meta
  ) VALUES (
    v_user, _mission, 'mission_extended', _minutes, 'manual',
    jsonb_build_object('title', v_mission.title, 'new_end', v_new_end::text)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', _mission,
    'new_end_time', v_new_end::text,
    'delta_min', _minutes
  );
END $$;

REVOKE ALL ON FUNCTION public.extend_mission_today(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_mission_today(uuid, int) TO authenticated;
