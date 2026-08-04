CREATE TABLE public.chat_message_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','hate','threat','scam','inappropriate','other')),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','dismissed','actioned')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);
GRANT SELECT, INSERT ON public.chat_message_flags TO authenticated;
GRANT ALL ON public.chat_message_flags TO service_role;
ALTER TABLE public.chat_message_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users report visible chat messages" ON public.chat_message_flags FOR INSERT TO authenticated WITH CHECK (
  reporter_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id
      AND (m.room = 'general'::public.chat_room OR (m.room = 'gang'::public.chat_room AND public.can_use_gang_chat(auth.uid())) OR (m.room = 'moderator'::public.chat_room AND public.is_mod_or_admin(auth.uid())))
  )
);
CREATE POLICY "reporters read own chat flags" ON public.chat_message_flags FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "super admins manage chat flags" ON public.chat_message_flags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.lucky_wheel_spins ADD COLUMN IF NOT EXISTS page_path text;

CREATE OR REPLACE FUNCTION public.lucky_wheel_spin(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign public.lucky_wheel_campaigns;
  v_state public.lucky_wheel_user_state;
  v_segment public.lucky_wheel_segments;
  v_total numeric;
  v_pick numeric;
  v_running numeric := 0;
  v_spins integer;
  v_balance bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_campaign FROM public.lucky_wheel_campaigns WHERE id = _campaign_id AND is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lucky Wheel is unavailable'; END IF;
  PERFORM public.lucky_wheel_register_display(_campaign_id);
  SELECT * INTO v_state FROM public.lucky_wheel_user_state WHERE campaign_id = _campaign_id AND user_id = v_uid FOR UPDATE;
  v_spins := v_campaign.base_spins_per_user + COALESCE(v_state.bonus_spins, 0) - COALESCE(v_state.spins_used, 0);
  IF v_spins <= 0 THEN RAISE EXCEPTION 'No spins remaining'; END IF;
  SELECT sum(weight) INTO v_total FROM public.lucky_wheel_segments WHERE campaign_id = _campaign_id;
  IF COALESCE(v_total, 0) <= 0 THEN RAISE EXCEPTION 'Wheel has no rewards'; END IF;
  v_pick := random() * v_total;
  FOR v_segment IN SELECT * FROM public.lucky_wheel_segments WHERE campaign_id = _campaign_id ORDER BY sort_order LOOP
    v_running := v_running + v_segment.weight;
    IF v_pick < v_running THEN EXIT; END IF;
  END LOOP;
  UPDATE public.lucky_wheel_user_state SET spins_used = spins_used + 1, last_spin_at = now(), updated_at = now() WHERE campaign_id = _campaign_id AND user_id = v_uid;
  IF v_segment.outcome_kind = 'tokens' AND v_segment.reward_amount > 0 THEN
    UPDATE public.profiles SET token_balance = token_balance + v_segment.reward_amount WHERE id = v_uid RETURNING token_balance INTO v_balance;
    INSERT INTO public.token_transactions(user_id, amount, type, reason, reference_id) VALUES (v_uid, v_segment.reward_amount, 'credit', 'Lucky Wheel: ' || v_segment.label, _campaign_id::text);
  ELSE
    SELECT token_balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  END IF;
  INSERT INTO public.lucky_wheel_spins(campaign_id, segment_id, user_id, outcome_kind, label, reward_amount, balance_after, page_path)
  VALUES (_campaign_id, v_segment.id, v_uid, v_segment.outcome_kind, v_segment.label, v_segment.reward_amount, v_balance, v_campaign.page_path);
  RETURN jsonb_build_object('segment_id', v_segment.id, 'label', v_segment.label, 'outcome_kind', v_segment.outcome_kind, 'reward_amount', v_segment.reward_amount, 'balance_after', v_balance, 'spins_remaining', v_spins - 1);
END;
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lucky_wheel_spins;