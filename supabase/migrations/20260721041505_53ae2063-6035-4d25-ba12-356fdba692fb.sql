ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS open_mode text NOT NULL DEFAULT 'new'
  CHECK (open_mode IN ('new', 'last'));