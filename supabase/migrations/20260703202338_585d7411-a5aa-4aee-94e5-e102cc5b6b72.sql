
DROP POLICY IF EXISTS "Public profile fields readable via view" ON public.profiles;

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT id, display_name, friend_code, behavioral_class, level_track,
       level, xp, streak
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated, anon;

REVOKE SELECT (invite_code) ON public.groups FROM authenticated;
REVOKE SELECT (invite_code) ON public.groups FROM anon;

CREATE OR REPLACE FUNCTION public.get_group_invite_code(_group uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_code FROM public.groups
   WHERE id = _group AND owner_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_group_invite_code(uuid) TO authenticated;

DROP POLICY IF EXISTS own_insert ON public.notifications;
REVOKE INSERT ON public.notifications FROM authenticated;
REVOKE INSERT ON public.notifications FROM anon;

CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.internal_config TO service_role;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_config (key, value)
VALUES ('webhook_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT := 'https://project--b3f7344d-7e3f-461e-b4de-595e7e045220.lovable.app/api/public/hooks/push-notification';
  v_secret TEXT;
BEGIN
  BEGIN
    SELECT value INTO v_secret FROM public.internal_config WHERE key = 'webhook_secret';
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', COALESCE(v_secret, '')
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;
