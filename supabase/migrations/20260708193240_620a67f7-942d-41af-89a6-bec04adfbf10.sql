
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS target INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS end_time TIME;
