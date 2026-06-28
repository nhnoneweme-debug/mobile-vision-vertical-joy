
REVOKE EXECUTE ON FUNCTION public.award_habit_xp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_habit_xp() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.habit_streak(_habit_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  s integer := 0;
  d date := CURRENT_DATE;
  has_today boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.habit_logs WHERE habit_id = _habit_id AND log_date = CURRENT_DATE) INTO has_today;
  IF NOT has_today THEN
    d := CURRENT_DATE - 1;
  END IF;
  LOOP
    IF EXISTS(SELECT 1 FROM public.habit_logs WHERE habit_id = _habit_id AND log_date = d) THEN
      s := s + 1;
      d := d - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN s;
END;
$$;
