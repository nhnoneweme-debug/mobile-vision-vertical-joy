
CREATE TABLE public.ai_capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  writes_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_capture_sessions TO authenticated;
GRANT ALL ON public.ai_capture_sessions TO service_role;
ALTER TABLE public.ai_capture_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.ai_capture_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.ai_capture_sessions(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,           -- insert | update | delete
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | applied | rejected | error
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_audit_log TO authenticated;
GRANT ALL ON public.ai_audit_log TO service_role;
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit" ON public.ai_audit_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_sessions_user ON public.ai_capture_sessions(user_id, updated_at DESC);
CREATE INDEX idx_ai_audit_user ON public.ai_audit_log(user_id, created_at DESC);

CREATE TRIGGER trg_ai_sessions_updated
  BEFORE UPDATE ON public.ai_capture_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
