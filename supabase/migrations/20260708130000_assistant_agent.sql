-- Agente de IA conversacional: anamnese (baseline RLS + repouso) e histórico do chat.

CREATE TABLE public.user_health_intake (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_health_intake TO authenticated;
GRANT ALL ON public.user_health_intake TO service_role;
ALTER TABLE public.user_health_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health_intake" ON public.user_health_intake
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_health_intake_touch BEFORE UPDATE ON public.user_health_intake
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assistant_messages" ON public.assistant_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX assistant_messages_user_idx ON public.assistant_messages (user_id, created_at);
