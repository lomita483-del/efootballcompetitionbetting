ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS tutorials_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tutorials_for_new_users boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tutorials_for_new_signins boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tutorials_for_visitors boolean NOT NULL DEFAULT false;

CREATE TABLE public.tutorial_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tour_key text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped', 'remind_later')),
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  remind_after timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_states TO authenticated;
GRANT ALL ON public.tutorial_states TO service_role;

ALTER TABLE public.tutorial_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tutorial state"
ON public.tutorial_states FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tutorial state"
ON public.tutorial_states FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tutorial state"
ON public.tutorial_states FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tutorial state"
ON public.tutorial_states FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Super Admins can view tutorial state"
ON public.tutorial_states FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_tutorial_state_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tutorial_states_touch_updated_at
BEFORE UPDATE ON public.tutorial_states
FOR EACH ROW EXECUTE FUNCTION public.touch_tutorial_state_updated_at();

CREATE INDEX tutorial_states_user_status_idx
ON public.tutorial_states (user_id, status);