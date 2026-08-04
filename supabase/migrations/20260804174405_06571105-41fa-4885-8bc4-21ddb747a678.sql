ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS chat_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_in_app_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_notification_rooms text[] NOT NULL DEFAULT ARRAY['global','general','moderator']::text[];

UPDATE public.app_settings
SET chat_notification_rooms = ARRAY['global','general','moderator']::text[]
WHERE chat_notification_rooms IS NULL OR cardinality(chat_notification_rooms) = 0;