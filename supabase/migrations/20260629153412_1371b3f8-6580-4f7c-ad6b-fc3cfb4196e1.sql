ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level_track text NOT NULL DEFAULT 'warrior_m';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_level_track_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_level_track_check
  CHECK (level_track IN ('warrior_m','strategist_m','mystic_m','warrior_f','strategist_f','mystic_f'));