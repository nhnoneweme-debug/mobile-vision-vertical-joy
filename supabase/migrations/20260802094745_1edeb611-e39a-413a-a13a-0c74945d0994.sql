ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_kind_check;

ALTER TABLE public.execution_events
  ADD CONSTRAINT execution_events_kind_check CHECK (
    kind = ANY (ARRAY[
      'manifest_shown'::text,
      'manifest_ack'::text,
      'mission_done'::text,
      'mission_skipped'::text,
      'mission_extended'::text,
      'mission_started'::text,
      'mission_ended'::text,
      'voice_note'::text,
      'negotiation'::text,
      'live_transcript'::text,
      'sensor_reading'::text,
      'journey_log'::text,
      'journey_log_declined'::text,
      'manual_log'::text,
      'day_review'::text
    ])
  );