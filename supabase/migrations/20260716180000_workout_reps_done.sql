-- Repetições realizadas por série.
--
-- O `reps` do plano é a META ("8-12"); não havia onde guardar o que a pessoa
-- realmente fez. Espelha `weights`: array por série, índice N = série N, e as
-- duas são escritas no mesmo update pra não dessincronizar o tamanho.

ALTER TABLE public.workout_progress
  ADD COLUMN IF NOT EXISTS reps_done JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workout_progress.reps_done IS
  'Repetições feitas por série. Espelha weights: o índice N é a série N.';
