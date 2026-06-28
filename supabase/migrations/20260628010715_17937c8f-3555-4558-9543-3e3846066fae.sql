
ALTER FUNCTION public.player_level(INT) SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_perk_unlocks(UUID) FROM PUBLIC, anon;
