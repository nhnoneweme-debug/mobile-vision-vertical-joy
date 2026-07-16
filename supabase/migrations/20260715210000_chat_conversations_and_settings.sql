-- Chat 2.0: agrupa mensagens do assistente em conversas (histórico) e adiciona
-- configuração da IA por usuário. Policy única FOR ALL (dono), no padrão de
-- food_log_entries.

-- 1) Conversas -------------------------------------------------------------
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations"
  ON public.chat_conversations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_conversations_user_idx ON public.chat_conversations(user_id, updated_at DESC);

-- 2) Vincula mensagens existentes a conversas ------------------------------
ALTER TABLE public.assistant_messages
  ADD COLUMN conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE;
CREATE INDEX assistant_messages_conversation_idx ON public.assistant_messages(conversation_id, created_at);

-- Backfill: 1 conversa por usuário com mensagens órfãs (preserva o histórico).
WITH users_with_msgs AS (
  SELECT DISTINCT user_id FROM public.assistant_messages WHERE conversation_id IS NULL
),
new_convs AS (
  INSERT INTO public.chat_conversations (user_id, title)
  SELECT user_id, 'Conversa anterior' FROM users_with_msgs
  RETURNING id, user_id
)
UPDATE public.assistant_messages am
  SET conversation_id = nc.id
  FROM new_convs nc
  WHERE am.user_id = nc.user_id AND am.conversation_id IS NULL;

-- 3) Configuração da IA por usuário ----------------------------------------
CREATE TABLE public.chat_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona text NOT NULL DEFAULT 'caloroso' CHECK (persona IN ('caloroso', 'direto', 'tecnico')),
  response_length text NOT NULL DEFAULT 'equilibrado' CHECK (response_length IN ('curtas', 'equilibrado', 'detalhadas')),
  focus text NOT NULL DEFAULT 'geral' CHECK (focus IN ('geral', 'treino', 'nutricao', 'mente')),
  custom_instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_settings TO authenticated;
GRANT ALL ON public.chat_settings TO service_role;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat settings"
  ON public.chat_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
