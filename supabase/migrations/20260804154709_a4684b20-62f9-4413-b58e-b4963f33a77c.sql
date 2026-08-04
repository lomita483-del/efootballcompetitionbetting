ALTER TABLE public.advertisements
  DROP CONSTRAINT IF EXISTS advertisements_placement_check;

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_placement_check
  CHECK (placement = 'all' OR placement ~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%/-]*$');