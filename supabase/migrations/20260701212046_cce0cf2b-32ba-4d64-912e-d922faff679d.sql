CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT := 'https://project--b3f7344d-7e3f-461e-b4de-595e7e045220.lovable.app/api/public/hooks/push-notification';
  v_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcXh2aHZ6dHpwdnJqZmJrY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTY2NTQsImV4cCI6MjA5NzgzMjY1NH0.adojIpquZwyvRsAV7hth9ddLNmqjG8pZNL1SEWmlJ1w';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_key
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silenciar erros para não bloquear o insert
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_push_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_push_realtime ON public.notifications;
CREATE TRIGGER notifications_push_realtime
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_insert();