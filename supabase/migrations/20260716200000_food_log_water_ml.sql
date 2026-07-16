-- Anel de consumo de água com meta diária.
--
-- A META já existia (hydration_ml, no plano alimentar); faltava o CONSUMIDO.
-- A água já era registrada no diário como entrada de 0 kcal ("Água · 1 copo
-- (200 ml)"), então a coluna entra aqui em vez de numa tabela nova: mantém uma
-- linha do tempo só e o delete/histórico existentes continuam valendo.

ALTER TABLE public.food_log_entries
  ADD COLUMN IF NOT EXISTS water_ml INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.food_log_entries.water_ml IS
  'Mililitros de água da entrada. 0 = não é hidratação. Alimenta o anel de água.';

-- Índice parcial: o anel só soma as entradas que têm água.
CREATE INDEX IF NOT EXISTS food_log_water_idx
  ON public.food_log_entries (user_id, log_date)
  WHERE water_ml > 0;
