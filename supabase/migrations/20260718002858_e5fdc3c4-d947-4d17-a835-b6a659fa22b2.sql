
-- 1) Short public match code
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_match_public_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits  TEXT := '23456789';
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := 'ECB-'
      || substr(letters, 1 + floor(random()*length(letters))::int, 1)
      || substr(letters, 1 + floor(random()*length(letters))::int, 1)
      || substr(letters, 1 + floor(random()*length(letters))::int, 1)
      || substr(digits,  1 + floor(random()*length(digits))::int, 1)
      || substr(digits,  1 + floor(random()*length(digits))::int, 1)
      || substr(digits,  1 + floor(random()*length(digits))::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.matches WHERE public_id = code);
    attempts := attempts + 1;
    IF attempts > 20 THEN
      code := 'ECB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      EXIT;
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_match_public_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_id IS NULL OR NEW.public_id = '' THEN
    NEW.public_id := public.gen_match_public_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_set_public_id ON public.matches;
CREATE TRIGGER matches_set_public_id
BEFORE INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.set_match_public_id();

-- Backfill
UPDATE public.matches SET public_id = public.gen_match_public_id()
WHERE public_id IS NULL OR public_id = '';
