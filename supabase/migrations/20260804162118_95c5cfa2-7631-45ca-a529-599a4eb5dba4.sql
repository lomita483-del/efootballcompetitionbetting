CREATE TABLE public.lucky_wheel_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'LUCKY WHEEL',
  subtitle text,
  page_path text NOT NULL DEFAULT '/',
  is_active boolean NOT NULL DEFAULT false,
  max_unique_users integer,
  base_spins_per_user integer NOT NULL DEFAULT 1 CHECK (base_spins_per_user >= 0),
  display_mode text NOT NULL DEFAULT 'once' CHECK (display_mode IN ('once','reload','earned')),
  max_displays_per_user integer CHECK (max_displays_per_user IS NULL OR max_displays_per_user > 0),
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_spin_points integer NOT NULL DEFAULT 1 CHECK (task_spin_points >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lucky_wheel_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lucky_wheel_campaigns TO authenticated;
GRANT ALL ON public.lucky_wheel_campaigns TO service_role;
ALTER TABLE public.lucky_wheel_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read available wheel campaigns" ON public.lucky_wheel_campaigns FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage wheel campaigns" ON public.lucky_wheel_campaigns FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.lucky_wheel_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lucky_wheel_campaigns(id) ON DELETE CASCADE,
  label text NOT NULL,
  outcome_kind text NOT NULL DEFAULT 'tokens' CHECK (outcome_kind IN ('tokens','lost')),
  reward_amount bigint NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  color_token text NOT NULL DEFAULT 'gold' CHECK (color_token IN ('gold','emerald','ruby','navy','violet','silver')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lucky_wheel_segments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lucky_wheel_segments TO authenticated;
GRANT ALL ON public.lucky_wheel_segments TO service_role;
ALTER TABLE public.lucky_wheel_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read active wheel segments" ON public.lucky_wheel_segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.lucky_wheel_campaigns c WHERE c.id = campaign_id AND (c.is_active OR public.is_admin(auth.uid()))));
CREATE POLICY "admins manage wheel segments" ON public.lucky_wheel_segments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.lucky_wheel_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lucky_wheel_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_count integer NOT NULL DEFAULT 0 CHECK (display_count >= 0),
  spin_count integer NOT NULL DEFAULT 0 CHECK (spin_count >= 0),
  earned_spin_points integer NOT NULL DEFAULT 0 CHECK (earned_spin_points >= 0),
  last_displayed_at timestamptz,
  last_spun_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);
GRANT SELECT ON public.lucky_wheel_user_state TO authenticated;
GRANT ALL ON public.lucky_wheel_user_state TO service_role;
ALTER TABLE public.lucky_wheel_user_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own wheel state" ON public.lucky_wheel_user_state FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage wheel state" ON public.lucky_wheel_user_state FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.lucky_wheel_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lucky_wheel_campaigns(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.lucky_wheel_segments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_kind text NOT NULL CHECK (outcome_kind IN ('tokens','lost')),
  label text NOT NULL,
  reward_amount bigint NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  balance_after bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lucky_wheel_spins TO authenticated;
GRANT ALL ON public.lucky_wheel_spins TO service_role;
ALTER TABLE public.lucky_wheel_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own wheel spins" ON public.lucky_wheel_spins FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX lucky_wheel_campaigns_page_active_idx ON public.lucky_wheel_campaigns (page_path, is_active);
CREATE INDEX lucky_wheel_segments_campaign_idx ON public.lucky_wheel_segments (campaign_id, sort_order);
CREATE INDEX lucky_wheel_spins_campaign_user_idx ON public.lucky_wheel_spins (campaign_id, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.lucky_wheel_register_display(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_campaign public.lucky_wheel_campaigns%ROWTYPE; v_state public.lucky_wheel_user_state%ROWTYPE; v_unique integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to use the Lucky Wheel'; END IF;
  SELECT * INTO v_campaign FROM public.lucky_wheel_campaigns WHERE id = _campaign_id FOR SHARE;
  IF NOT FOUND OR NOT v_campaign.is_active OR (v_campaign.starts_at IS NOT NULL AND now() < v_campaign.starts_at) OR (v_campaign.ends_at IS NOT NULL AND now() > v_campaign.ends_at) THEN RAISE EXCEPTION 'This Lucky Wheel is not available'; END IF;
  INSERT INTO public.lucky_wheel_user_state (campaign_id,user_id) VALUES (_campaign_id,v_uid) ON CONFLICT (campaign_id,user_id) DO NOTHING;
  SELECT * INTO v_state FROM public.lucky_wheel_user_state WHERE campaign_id=_campaign_id AND user_id=v_uid FOR UPDATE;
  IF v_campaign.max_displays_per_user IS NOT NULL AND v_state.display_count >= v_campaign.max_displays_per_user THEN RETURN jsonb_build_object('show',false,'reason','display_limit'); END IF;
  SELECT count(*) INTO v_unique FROM public.lucky_wheel_user_state WHERE campaign_id=_campaign_id AND spin_count > 0;
  IF v_campaign.max_unique_users IS NOT NULL AND v_unique >= v_campaign.max_unique_users AND v_state.spin_count = 0 THEN RETURN jsonb_build_object('show',false,'reason','user_limit'); END IF;
  IF v_campaign.display_mode='earned' AND (v_campaign.base_spins_per_user + v_state.earned_spin_points - v_state.spin_count) <= 0 THEN RETURN jsonb_build_object('show',false,'reason','no_points'); END IF;
  UPDATE public.lucky_wheel_user_state SET display_count=display_count+1,last_displayed_at=now(),updated_at=now() WHERE id=v_state.id;
  RETURN jsonb_build_object('show',true,'spins_remaining',greatest(0,v_campaign.base_spins_per_user+v_state.earned_spin_points-v_state.spin_count));
END $$;
GRANT EXECUTE ON FUNCTION public.lucky_wheel_register_display(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lucky_wheel_spin(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_campaign public.lucky_wheel_campaigns%ROWTYPE; v_state public.lucky_wheel_user_state%ROWTYPE; v_segment public.lucky_wheel_segments%ROWTYPE; v_total integer; v_pick integer; v_running integer := 0; v_unique integer; v_balance bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to spin'; END IF;
  SELECT * INTO v_campaign FROM public.lucky_wheel_campaigns WHERE id=_campaign_id FOR UPDATE;
  IF NOT FOUND OR NOT v_campaign.is_active OR (v_campaign.starts_at IS NOT NULL AND now()<v_campaign.starts_at) OR (v_campaign.ends_at IS NOT NULL AND now()>v_campaign.ends_at) THEN RAISE EXCEPTION 'This Lucky Wheel is not available'; END IF;
  INSERT INTO public.lucky_wheel_user_state (campaign_id,user_id) VALUES (_campaign_id,v_uid) ON CONFLICT (campaign_id,user_id) DO NOTHING;
  SELECT * INTO v_state FROM public.lucky_wheel_user_state WHERE campaign_id=_campaign_id AND user_id=v_uid FOR UPDATE;
  IF v_state.spin_count >= v_campaign.base_spins_per_user + v_state.earned_spin_points THEN RAISE EXCEPTION 'You have no spins remaining'; END IF;
  SELECT count(*) INTO v_unique FROM public.lucky_wheel_user_state WHERE campaign_id=_campaign_id AND spin_count>0;
  IF v_campaign.max_unique_users IS NOT NULL AND v_unique >= v_campaign.max_unique_users AND v_state.spin_count=0 THEN RAISE EXCEPTION 'This Lucky Wheel has reached its user limit'; END IF;
  SELECT sum(weight) INTO v_total FROM public.lucky_wheel_segments WHERE campaign_id=_campaign_id;
  IF coalesce(v_total,0)<=0 THEN RAISE EXCEPTION 'This Lucky Wheel has no rewards configured'; END IF;
  v_pick := floor(random()*v_total)::integer + 1;
  FOR v_segment IN SELECT * FROM public.lucky_wheel_segments WHERE campaign_id=_campaign_id ORDER BY sort_order,id LOOP
    v_running := v_running + v_segment.weight;
    EXIT WHEN v_pick <= v_running;
  END LOOP;
  IF v_segment.outcome_kind='tokens' AND v_segment.reward_amount>0 THEN
    UPDATE public.profiles SET token_balance=token_balance+v_segment.reward_amount WHERE id=v_uid RETURNING token_balance INTO v_balance;
    INSERT INTO public.token_transactions(user_id,amount,balance_after,kind,description,metadata) VALUES(v_uid,v_segment.reward_amount,v_balance,'lucky_wheel','Lucky Wheel: '||v_segment.label,jsonb_build_object('campaign_id',_campaign_id,'segment_id',v_segment.id));
  ELSE SELECT token_balance INTO v_balance FROM public.profiles WHERE id=v_uid; END IF;
  UPDATE public.lucky_wheel_user_state SET spin_count=spin_count+1,last_spun_at=now(),updated_at=now() WHERE id=v_state.id;
  INSERT INTO public.lucky_wheel_spins(campaign_id,segment_id,user_id,outcome_kind,label,reward_amount,balance_after) VALUES(_campaign_id,v_segment.id,v_uid,v_segment.outcome_kind,v_segment.label,v_segment.reward_amount,v_balance);
  RETURN jsonb_build_object('ok',true,'segment_id',v_segment.id,'label',v_segment.label,'outcome_kind',v_segment.outcome_kind,'reward_amount',v_segment.reward_amount,'balance',v_balance,'spins_remaining',greatest(0,v_campaign.base_spins_per_user+v_state.earned_spin_points-v_state.spin_count-1));
END $$;
GRANT EXECUTE ON FUNCTION public.lucky_wheel_spin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lucky_wheel_award_task_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reward_claimed AND NOT OLD.reward_claimed THEN
    INSERT INTO public.lucky_wheel_user_state(campaign_id,user_id,earned_spin_points)
    SELECT c.id,NEW.user_id,c.task_spin_points FROM public.lucky_wheel_campaigns c WHERE c.is_active AND c.linked_task_id=NEW.task_id AND c.task_spin_points>0
    ON CONFLICT(campaign_id,user_id) DO UPDATE SET earned_spin_points=public.lucky_wheel_user_state.earned_spin_points+EXCLUDED.earned_spin_points,updated_at=now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lucky_wheel_task_points_after_claim AFTER UPDATE OF reward_claimed ON public.user_task_progress FOR EACH ROW EXECUTE FUNCTION public.lucky_wheel_award_task_points();

CREATE TRIGGER lucky_wheel_campaigns_updated_at BEFORE UPDATE ON public.lucky_wheel_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER lucky_wheel_user_state_updated_at BEFORE UPDATE ON public.lucky_wheel_user_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();