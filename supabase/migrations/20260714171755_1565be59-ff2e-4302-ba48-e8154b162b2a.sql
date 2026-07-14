
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  goal text,
  kcal_target int,
  protein_g int,
  carbs_g int,
  fat_g int,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plans TO authenticated;
GRANT ALL ON public.meal_plans TO service_role;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal plans"
  ON public.meal_plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX meal_plans_user_status_idx ON public.meal_plans(user_id, status);
CREATE TRIGGER meal_plans_touch_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  day_of_week int,
  meal_slot text NOT NULL,
  position int NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  kcal int,
  protein_g int,
  carbs_g int,
  fat_g int
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_items TO authenticated;
GRANT ALL ON public.meal_plan_items TO service_role;
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view items of their own plans"
  ON public.meal_plan_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.meal_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert items into their own plans"
  ON public.meal_plan_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update items of their own plans"
  ON public.meal_plan_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.meal_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete items of their own plans"
  ON public.meal_plan_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.meal_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
CREATE INDEX meal_plan_items_plan_idx ON public.meal_plan_items(plan_id, day_of_week, position);

CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_item_id uuid REFERENCES public.meal_plan_items(id) ON DELETE SET NULL,
  log_date date NOT NULL,
  status text NOT NULL DEFAULT 'eaten',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_item_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_logs TO authenticated;
GRANT ALL ON public.meal_logs TO service_role;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own meal logs"
  ON public.meal_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX meal_logs_user_date_idx ON public.meal_logs(user_id, log_date);
