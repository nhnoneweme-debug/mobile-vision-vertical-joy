-- Diário alimentar: registro de alimentos consumidos (foto/IA de visão,
-- código de barras ou manual). Base real para o anel de calorias e o
-- gráfico semanal/mensal da tela de Plano Alimentar.
--
-- Policy única "FOR ALL" (select+insert+update+delete), igual ao padrão já
-- usado em meal_plans/meal_logs — aprendendo com o erro do area_progress,
-- que só tinha SELECT e quebrava qualquer escrita do usuário.

CREATE TABLE public.food_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  logged_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  quantity_text text,
  kcal int NOT NULL CHECK (kcal >= 0 AND kcal <= 20000),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('photo', 'barcode', 'manual')),
  barcode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_log_entries TO authenticated;
GRANT ALL ON public.food_log_entries TO service_role;

ALTER TABLE public.food_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own food log entries"
  ON public.food_log_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX food_log_entries_user_date_idx ON public.food_log_entries(user_id, log_date);
