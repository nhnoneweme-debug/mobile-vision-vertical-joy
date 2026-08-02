-- Aditivo: amplia CHECK de kind e phase em public.execution_events.
-- ROLLBACK:
--   ALTER TABLE public.execution_events DROP CONSTRAINT execution_events_kind_check;
--   ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_kind_check
--     CHECK (kind = ANY (ARRAY['manifest_shown','manifest_ack','mission_done','mission_skipped','mission_extended','mission_started','mission_ended','voice_note','negotiation']));
--   ALTER TABLE public.execution_events DROP CONSTRAINT execution_events_phase_check;
--   ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_phase_check
--     CHECK (phase = ANY (ARRAY['preEnd','atEnd','preStart']));
--   DROP INDEX IF EXISTS public.execution_events_live_idx;

ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_kind_check;
ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_kind_check
  CHECK (kind = ANY (ARRAY[
    'manifest_shown','manifest_ack','mission_done','mission_skipped',
    'mission_extended','mission_started','mission_ended','voice_note',
    'negotiation','live_transcript','sensor_reading'
  ]));

ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_phase_check;
ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_phase_check
  CHECK (phase IS NULL OR phase = ANY (ARRAY['preEnd','atEnd','preStart','atStart']));

CREATE INDEX IF NOT EXISTS execution_events_live_idx
  ON public.execution_events (user_id, kind, occurred_at DESC);