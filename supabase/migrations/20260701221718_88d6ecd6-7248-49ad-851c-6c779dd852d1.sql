CREATE TABLE public.orientador_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orientador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orientador_messages_pair_idx
  ON public.orientador_messages (orientador_id, student_id, created_at DESC);
CREATE INDEX orientador_messages_student_idx
  ON public.orientador_messages (student_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.orientador_messages TO authenticated;
GRANT ALL ON public.orientador_messages TO service_role;

ALTER TABLE public.orientador_messages ENABLE ROW LEVEL SECURITY;

-- Only the active pair (orientador + student) may read
CREATE POLICY "pair can read messages"
  ON public.orientador_messages FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id OR auth.uid() = orientador_id)
    AND EXISTS (
      SELECT 1 FROM public.orientador_students os
      WHERE os.orientador_id = orientador_messages.orientador_id
        AND os.student_id = orientador_messages.student_id
        AND os.status = 'active'
    )
  );

-- Sender must be part of the pair, and pair must be active
CREATE POLICY "pair can send messages"
  ON public.orientador_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (auth.uid() = student_id OR auth.uid() = orientador_id)
    AND EXISTS (
      SELECT 1 FROM public.orientador_students os
      WHERE os.orientador_id = orientador_messages.orientador_id
        AND os.student_id = orientador_messages.student_id
        AND os.status = 'active'
    )
  );

-- Recipient may mark as read
CREATE POLICY "recipient can mark read"
  ON public.orientador_messages FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (student_id, orientador_id)
    AND auth.uid() <> sender_id
  )
  WITH CHECK (
    auth.uid() IN (student_id, orientador_id)
    AND auth.uid() <> sender_id
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.orientador_messages;