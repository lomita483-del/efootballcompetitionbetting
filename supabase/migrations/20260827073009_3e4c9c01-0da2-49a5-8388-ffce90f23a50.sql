ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS signups_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signups_disabled_message text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta_code text;
  ref_id uuid;
  signups_on boolean;
  closed_msg text;
BEGIN
  SELECT COALESCE(signups_enabled, true), signups_disabled_message
    INTO signups_on, closed_msg
  FROM public.app_settings WHERE id = 1;

  IF signups_on IS FALSE THEN
    RAISE EXCEPTION '%', COALESCE(NULLIF(trim(closed_msg), ''), 'New account registration is currently closed. Please try again later.')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, discord_username, discord_full_name, ingame_name, country, region, gang_name, gang_type, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'discord_username',
    NEW.raw_user_meta_data->>'discord_full_name',
    NEW.raw_user_meta_data->>'ingame_name',
    NEW.raw_user_meta_data->>'country',
    COALESCE(
      NEW.raw_user_meta_data->>'region',
      NEW.raw_user_meta_data->>'server',
      'LOMITA AFR'
    ),
    NEW.raw_user_meta_data->>'gang_name',
    NULLIF(NEW.raw_user_meta_data->>'gang_type','')::public.gang_type,
    'LSL-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6))
  );

  IF NEW.email = 'lomitashootersleague@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;

  meta_code := COALESCE(NEW.raw_user_meta_data->>'referral_code', NEW.raw_user_meta_data->>'referred_by');
  IF meta_code IS NOT NULL AND length(trim(meta_code)) > 0 THEN
    SELECT id INTO ref_id FROM public.profiles
      WHERE upper(referral_code) = upper(trim(meta_code)) AND id <> NEW.id LIMIT 1;
    IF ref_id IS NOT NULL THEN
      UPDATE public.profiles SET referred_by = ref_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END $function$;