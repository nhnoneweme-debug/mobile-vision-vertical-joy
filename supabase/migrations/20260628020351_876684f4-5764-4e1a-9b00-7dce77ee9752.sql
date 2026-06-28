CREATE TABLE public.oracle_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.oracle_messages TO authenticated;
GRANT ALL ON public.oracle_messages TO service_role;
ALTER TABLE public.oracle_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own oracle messages" ON public.oracle_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own oracle messages" ON public.oracle_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own oracle messages" ON public.oracle_messages FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX oracle_messages_user_created_idx ON public.oracle_messages(user_id, created_at);