
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'journey-tick-every-minute') THEN
    PERFORM cron.unschedule('journey-tick-every-minute');
  END IF;
END $$;

SELECT cron.schedule(
  'journey-tick-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--b3f7344d-7e3f-461e-b4de-595e7e045220.lovable.app/api/public/hooks/journey-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', COALESCE((SELECT value FROM public.internal_config WHERE key = 'webhook_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
