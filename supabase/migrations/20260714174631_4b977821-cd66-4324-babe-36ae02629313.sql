
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.public_profiles_lookup(_ids uuid[])
RETURNS TABLE (id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(p.display_name, 'Viajante')
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$$;

REVOKE EXECUTE ON FUNCTION public.public_profiles_lookup(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profiles_lookup(uuid[]) TO authenticated, anon;

DROP POLICY IF EXISTS "internal_config no client access" ON public.internal_config;
CREATE POLICY "internal_config no client access"
  ON public.internal_config
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.internal_config FROM authenticated, anon;
GRANT ALL ON public.internal_config TO service_role;
