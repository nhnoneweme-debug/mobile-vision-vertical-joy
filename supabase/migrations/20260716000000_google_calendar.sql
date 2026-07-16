-- Google Calendar: armazena tokens OAuth e preferências de sincronização por usuário.
-- Policy única FOR ALL (dono), no padrão de food_log_entries.

CREATE TABLE public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own google calendar connection"
  ON public.google_calendar_connections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice para buscas por expiration (refresh flow)
CREATE INDEX google_calendar_connections_expires_idx
  ON public.google_calendar_connections(token_expires_at);

-- Tabela de mapeamento missão <-> evento do Google (para sync bidirecional)
CREATE TABLE public.google_calendar_event_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.user_missions(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_event_map TO authenticated;
GRANT ALL ON public.google_calendar_event_map TO service_role;
ALTER TABLE public.google_calendar_event_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own google calendar event map"
  ON public.google_calendar_event_map FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX google_calendar_event_map_user_idx
  ON public.google_calendar_event_map(user_id, last_synced_at DESC);
