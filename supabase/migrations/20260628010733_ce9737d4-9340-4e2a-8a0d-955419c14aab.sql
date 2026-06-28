
DROP FUNCTION IF EXISTS public.check_perk_unlocks(UUID);

CREATE OR REPLACE FUNCTION public.check_perk_unlocks()
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_class TEXT;
  v_level INT;
  v_inserted INT;
BEGIN
  IF v_user IS NULL THEN RETURN 0; END IF;

  SELECT behavioral_class, public.player_level(xp)
    INTO v_class, v_level
  FROM public.profiles WHERE id = v_user;

  IF v_class IS NULL THEN RETURN 0; END IF;

  WITH ins AS (
    INSERT INTO public.user_perks (user_id, perk_id)
    SELECT v_user, sp.id
    FROM public.skill_perks sp
    WHERE sp.class = v_class
      AND sp.unlock_level <= v_level
      AND NOT EXISTS (
        SELECT 1 FROM public.user_perks up
        WHERE up.user_id = v_user AND up.perk_id = sp.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END $$;

GRANT EXECUTE ON FUNCTION public.check_perk_unlocks() TO authenticated;
