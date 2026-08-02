-- FATIA 3.1 — Log de Jornada: amplia os kinds aceitos em execution_events.
-- Aditivo e reversível.
--
-- ROLLBACK:
--   ALTER TABLE public.execution_events DROP CONSTRAINT execution_events_kind_check;
--   ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_kind_check
--     CHECK (kind = ANY (ARRAY['manifest_shown','manifest_ack','mission_done','mission_skipped',
--       'mission_extended','mission_started','mission_ended','voice_note','negotiation',
--       'live_transcript','sensor_reading']));
--   (execute apenas depois de remover/arquivar as linhas com os kinds novos)

ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_kind_check;

ALTER TABLE public.execution_events
  ADD CONSTRAINT execution_events_kind_check CHECK (
    kind = ANY (ARRAY[
      'manifest_shown','manifest_ack','mission_done','mission_skipped',
      'mission_extended','mission_started','mission_ended','voice_note',
      'negotiation','live_transcript','sensor_reading',
      'journey_log','journey_log_declined'
    ])
  );