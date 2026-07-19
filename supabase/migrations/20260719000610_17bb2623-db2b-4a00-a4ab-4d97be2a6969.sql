
-- Allow guest (unauthenticated) push subscriptions
ALTER TABLE public.push_subscriptions ALTER COLUMN user_id DROP NOT NULL;

GRANT INSERT, UPDATE ON public.push_subscriptions TO anon;

-- Guests can insert/update their own subscription row (matched by endpoint on upsert)
DROP POLICY IF EXISTS "guest push insert" ON public.push_subscriptions;
CREATE POLICY "guest push insert" ON public.push_subscriptions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "guest push update" ON public.push_subscriptions;
CREATE POLICY "guest push update" ON public.push_subscriptions
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
