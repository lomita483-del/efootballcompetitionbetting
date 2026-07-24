
CREATE OR REPLACE FUNCTION public.award_wager_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'settled' AND (OLD.status IS DISTINCT FROM 'settled') THEN
    UPDATE public.profiles SET xp = xp + 20 WHERE id IN (NEW.challenger_id, NEW.opponent_id);
    IF NEW.winner_id IS NOT NULL THEN
      UPDATE public.profiles
        SET xp = xp + LEAST(GREATEST(NEW.stake / 10, 0), 500)::int
        WHERE id = NEW.winner_id;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.award_wager_season_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE active_season_id UUID; pts INT; existing_id UUID;
BEGIN
  IF NEW.status = 'settled' AND (OLD.status IS DISTINCT FROM 'settled') AND NEW.winner_id IS NOT NULL THEN
    SELECT id INTO active_season_id FROM public.seasons WHERE is_active = true ORDER BY starts_at DESC LIMIT 1;
    IF active_season_id IS NOT NULL THEN
      pts := LEAST(GREATEST(NEW.stake / 50, 1), 1000000)::int;
      SELECT id INTO existing_id FROM public.season_points WHERE season_id = active_season_id AND user_id = NEW.winner_id;
      IF existing_id IS NULL THEN
        INSERT INTO public.season_points (season_id, user_id, points) VALUES (active_season_id, NEW.winner_id, pts);
      ELSE
        UPDATE public.season_points SET points = points + pts WHERE id = existing_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
