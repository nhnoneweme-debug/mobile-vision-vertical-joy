ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS composer_placeholder text NOT NULL DEFAULT '';