CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX group_messages_group_created_idx ON public.group_messages(group_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read group messages"
  ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members send group messages"
  ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Authors delete own messages"
  ON public.group_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;