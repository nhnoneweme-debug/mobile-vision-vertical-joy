-- area_progress nunca teve GRANT/policy de INSERT ou UPDATE para o papel
-- "authenticated" (só SELECT foi concedido na migration original). Escritas via
-- trigger SECURITY DEFINER (award_area_mission_xp) sempre funcionaram, mas
-- qualquer escrita direta feita pelo usuário autenticado (ex.: salvar/gerar
-- plano de dieta em area_progress.meta) falhava com:
--   "new row violates row-level security policy for table area_progress"
-- Isso bloqueava saveDietToArea (parseDietPlan, generateDietFromProfile,
-- saveDietPlan, clearDietPlan, restoreDietPlan em cozinha.functions.ts) e o
-- CozinhaDietCard desde que a tabela foi criada.

GRANT INSERT, UPDATE ON public.area_progress TO authenticated;

CREATE POLICY "Users insert own area progress"
  ON public.area_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own area progress"
  ON public.area_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
