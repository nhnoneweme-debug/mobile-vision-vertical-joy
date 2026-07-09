-- Execução do treino: peso por série.
-- weights (jsonb): array de números, um por série feita (índice = nº da série - 1).
ALTER TABLE public.workout_progress
  ADD COLUMN IF NOT EXISTS weights JSONB NOT NULL DEFAULT '[]'::jsonb;
