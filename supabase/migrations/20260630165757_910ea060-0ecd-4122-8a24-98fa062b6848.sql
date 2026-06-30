
-- 1. PROFILES: drop the blanket SELECT policy; keep own-profile and orientador access
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;

-- Public-safe projection of profiles
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, display_name, friend_code, behavioral_class, level_track, level
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Add a narrow row policy so the view (security_invoker) can read rows for any authenticated user.
-- The view only exposes safe columns; sensitive columns are still gated by the existing own/orientador policies.
CREATE POLICY "Public profile fields readable via view"
ON public.profiles FOR SELECT
TO authenticated
USING (true);
-- NOTE: This re-introduces row visibility, but to restrict columns we strip column GRANTs on sensitive fields.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, friend_code, behavioral_class, level_track, level)
  ON public.profiles TO authenticated;

-- 2. GROUPS: remove blanket SELECT by invite_code
DROP POLICY IF EXISTS "Lookup group by invite code" ON public.groups;

CREATE OR REPLACE FUNCTION public.join_group_by_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_group_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT id INTO v_group_id FROM public.groups WHERE invite_code = _code;
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN v_group_id;
END $$;

-- 3-6. Remove client INSERT on currency/xp/perks/crystals tables
DROP POLICY IF EXISTS "own brasas events insert" ON public.brasas_events;
DROP POLICY IF EXISTS "insert own xp" ON public.xp_events;
DROP POLICY IF EXISTS "own perks insert" ON public.user_perks;
DROP POLICY IF EXISTS "user_crystals_modify_own" ON public.user_crystals;
DROP POLICY IF EXISTS "user_crystals_select_own" ON public.user_crystals;
CREATE POLICY "user_crystals_select_own"
ON public.user_crystals FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 7. USER_ACHIEVEMENTS: restrict UPDATE to 'seen' column only
REVOKE UPDATE ON public.user_achievements FROM authenticated;
GRANT UPDATE (seen) ON public.user_achievements TO authenticated;

-- 8. ORIENTADOR_INVITES: explicit deny-all SELECT
DROP POLICY IF EXISTS "orientador_invites_no_client_access" ON public.orientador_invites;
CREATE POLICY "orientador_invites_no_client_access"
ON public.orientador_invites FOR SELECT
TO authenticated, anon
USING (false);

-- 9. CAN_VIEW_POST: fix friendships column names
CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid, _viewer uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD; is_friend BOOLEAN; shares_guild BOOLEAN; same_class BOOLEAN;
  is_targeted BOOLEAN; is_excluded BOOLEAN;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF p.author_id = _viewer THEN RETURN TRUE; END IF;
  SELECT EXISTS(SELECT 1 FROM public.post_audience
    WHERE post_id = _post_id AND audience_type = 'exclude_user' AND audience_id = _viewer::text) INTO is_excluded;
  IF is_excluded THEN RETURN FALSE; END IF;
  IF p.visibility_mode = 'public' THEN RETURN TRUE; END IF;
  IF p.visibility_mode IN ('manual','hybrid') THEN
    SELECT EXISTS(SELECT 1 FROM public.post_audience pa WHERE pa.post_id = _post_id AND (
      (pa.audience_type = 'user' AND pa.audience_id = _viewer::text)
      OR (pa.audience_type = 'guild' AND EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id::text = pa.audience_id AND gm.user_id = _viewer))
      OR (pa.audience_type = 'class' AND EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id = _viewer AND pr.behavioral_class = pa.audience_id))
      OR (pa.audience_type = 'friend' AND EXISTS(SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
            AND ((f.requester_id = p.author_id AND f.addressee_id = _viewer) OR (f.addressee_id = p.author_id AND f.requester_id = _viewer))))
    )) INTO is_targeted;
    IF is_targeted THEN RETURN TRUE; END IF;
    IF p.visibility_mode = 'manual' THEN RETURN FALSE; END IF;
  END IF;
  IF COALESCE((p.visibility_rule->>'friends')::boolean, true) THEN
    SELECT EXISTS(SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
      AND ((f.requester_id = p.author_id AND f.addressee_id = _viewer) OR (f.addressee_id = p.author_id AND f.requester_id = _viewer))) INTO is_friend;
    IF is_friend THEN RETURN TRUE; END IF;
  END IF;
  IF (p.visibility_rule->>'guild')::boolean IS TRUE THEN
    SELECT EXISTS(SELECT 1 FROM public.group_members g1
      JOIN public.group_members g2 ON g1.group_id = g2.group_id
      WHERE g1.user_id = p.author_id AND g2.user_id = _viewer) INTO shares_guild;
    IF shares_guild THEN RETURN TRUE; END IF;
  END IF;
  IF (p.visibility_rule->>'class')::boolean IS TRUE THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles a JOIN public.profiles v ON v.behavioral_class = a.behavioral_class
      WHERE a.id = p.author_id AND v.id = _viewer) INTO same_class;
    IF same_class THEN RETURN TRUE; END IF;
  END IF;
  IF (p.visibility_rule->>'followers')::boolean IS TRUE THEN
    IF EXISTS(SELECT 1 FROM public.follows WHERE follower_id = _viewer AND followed_id = p.author_id) THEN RETURN TRUE; END IF;
  END IF;
  RETURN FALSE;
END $function$;

-- 10. SECURITY DEFINER: revoke from public/anon; grant only to authenticated where needed
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crystal_active(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_level(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.habit_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_activity(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_personal_ia_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_perk_unlocks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_inventory_item(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_orientador_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_challenge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_by_invite(text) TO authenticated;
