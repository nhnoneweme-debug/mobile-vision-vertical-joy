ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS voice_gender text NOT NULL DEFAULT 'feminina'
    CHECK (voice_gender IN ('feminina', 'masculina'));

COMMENT ON COLUMN public.chat_settings.voice_gender IS
  'Genero da voz da IA (feminina|masculina). Vale para Lovable AI Gateway TTS e Web Speech fallback.';