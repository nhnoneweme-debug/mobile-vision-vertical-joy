
-- F1: public_profiles em modo definer (view mascara colunas; base table permanece restrita)
ALTER VIEW public.public_profiles SET (security_invoker = false);

-- F2: policy de insert próprio em user_perks (check_perk_unlocks roda como invoker)
DROP POLICY IF EXISTS "user_perks self insert" ON public.user_perks;
CREATE POLICY "user_perks self insert" ON public.user_perks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- F5: typo onboarding_complete -> onboarding_completed
CREATE OR REPLACE FUNCTION public.generate_nudges_all_users()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  users_count INT := 0;
  total_nudges INT := 0;
  errors_count INT := 0;
  n INT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE onboarding_completed = true LOOP
    BEGIN
      n := public.generate_nudges_for(r.id);
      users_count := users_count + 1;
      total_nudges := total_nudges + COALESCE(n, 0);
    EXCEPTION WHEN OTHERS THEN
      errors_count := errors_count + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('users', users_count, 'nudges', total_nudges, 'errors', errors_count, 'ran_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_weekly_score_snapshot()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  data JSONB;
  inserted INT := 0;
  wk DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles WHERE onboarding_completed = true
  LOOP
    data := public.compute_personal_ia_score(r.id);
    INSERT INTO public.score_snapshots (user_id, week_start, score, breakdown)
    VALUES (r.id, wk, (data->>'score')::INT, data->'breakdown')
    ON CONFLICT (user_id, week_start)
      DO UPDATE SET score = EXCLUDED.score, breakdown = EXCLUDED.breakdown;
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END;
$function$;
