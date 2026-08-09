ALTER TABLE public.bets ALTER COLUMN tracking_id DROP DEFAULT;
ALTER TABLE public.bets ALTER COLUMN tracking_id TYPE text USING tracking_id::text;
ALTER TABLE public.bets ALTER COLUMN tracking_id SET DEFAULT ('ECB-' || upper(substr(replace((gen_random_uuid())::text,'-',''), 1, 10)));
UPDATE public.bets SET tracking_id = 'ECB-' || upper(substr(replace((gen_random_uuid())::text,'-',''), 1, 10)) WHERE tracking_id IS NULL OR tracking_id = '';