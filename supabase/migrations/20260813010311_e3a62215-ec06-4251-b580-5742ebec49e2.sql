
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid;

DROP POLICY IF EXISTS "update own" ON public.chat_messages;
CREATE POLICY "update own or moderator" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.chat_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'sticker',
  name text NOT NULL,
  url text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_assets TO authenticated;
GRANT ALL ON public.chat_assets TO service_role;
ALTER TABLE public.chat_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat assets readable" ON public.chat_assets;
CREATE POLICY "chat assets readable" ON public.chat_assets FOR SELECT USING (true);
DROP POLICY IF EXISTS "chat assets admin manage" ON public.chat_assets;
CREATE POLICY "chat assets admin manage" ON public.chat_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx ON public.chat_messages (room, created_at DESC);
