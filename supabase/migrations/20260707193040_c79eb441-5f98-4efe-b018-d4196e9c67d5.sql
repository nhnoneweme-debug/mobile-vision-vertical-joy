
-- 1. Recreate public_profiles view with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, display_name, friend_code, behavioral_class, level_track, level, xp, streak
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2. Restrict follows SELECT to rows where caller is follower or followed
DROP POLICY IF EXISTS follows_select_all ON public.follows;
CREATE POLICY follows_select_own
  ON public.follows
  FOR SELECT
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = followed_id);

-- 3. Add reciprocal visibility for user_blocks: blocked users can also see the block on them
CREATE POLICY block_select_reciprocal
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = blocked_id);
