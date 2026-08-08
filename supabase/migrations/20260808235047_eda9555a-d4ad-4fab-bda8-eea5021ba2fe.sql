ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS league_arena_url text,
  ADD COLUMN IF NOT EXISTS league_arena_fit text DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS league_arena_position text DEFAULT 'center';