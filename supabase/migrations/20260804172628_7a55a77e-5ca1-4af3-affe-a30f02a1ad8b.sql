ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS skip_push boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.queue_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
BEGIN
  IF NEW.user_id IS NULL OR NEW.skip_push THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.push_delivery_log(notification_id)
  VALUES (NEW.id)
  ON CONFLICT (notification_id) DO NOTHING;

  SELECT push_endpoint_url INTO v_url FROM public.app_settings_private WHERE id = 1;
  IF v_url IS NOT NULL AND length(trim(v_url)) > 0 THEN
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('notification_id', NEW.id),
      headers := jsonb_build_object('Content-Type','application/json'),
      timeout_milliseconds := 5000
    );
  END IF;

  RETURN NEW;
END;
$$;