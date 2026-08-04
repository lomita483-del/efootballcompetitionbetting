ALTER TABLE public.advertisements
  DROP CONSTRAINT IF EXISTS advertisements_placement_check;

UPDATE public.advertisements
SET placement = 'all'
WHERE placement = 'both';

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_placement_check
  CHECK (placement = 'all' OR placement ~ '^/[a-z0-9_./-]*$');