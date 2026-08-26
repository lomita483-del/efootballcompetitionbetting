-- 1. Push webhook shared secret for DB triggers / cron ------------------------
ALTER TABLE public.app_settings_private ADD COLUMN IF NOT EXISTS push_webhook_secret text;
UPDATE public.app_settings_private
   SET push_webhook_secret = '6e6faac762917d91b3c5d8cc3166e290205d666dd58e39eb615520286fdb0e27'
 WHERE id = 1;
INSERT INTO public.app_settings_private (id, push_webhook_secret)
SELECT 1, '6e6faac762917d91b3c5d8cc3166e290205d666dd58e39eb615520286fdb0e27'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings_private WHERE id = 1);

CREATE OR REPLACE FUNCTION public.notify_announcement_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT broadcast_endpoint_url, push_webhook_secret INTO v_url, v_secret FROM public.app_settings_private WHERE id = 1;
  IF v_url IS NULL OR length(trim(v_url)) = 0 THEN RETURN NEW; END IF;
  PERFORM net.http_post(url := v_url,
    body := jsonb_build_object('kind','announcement','id',NEW.id),
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret',coalesce(v_secret,'')),
    timeout_milliseconds := 5000);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_match_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  IF NEW.is_virtual IS TRUE THEN RETURN NEW; END IF;
  SELECT broadcast_endpoint_url, push_webhook_secret INTO v_url, v_secret FROM public.app_settings_private WHERE id = 1;
  IF v_url IS NULL OR length(trim(v_url)) = 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' THEN
    PERFORM net.http_post(url := v_url,
      body := jsonb_build_object('kind','match_live','id',NEW.id),
      headers := jsonb_build_object('Content-Type','application/json','x-push-secret',coalesce(v_secret,'')),
      timeout_milliseconds := 5000);
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'scheduled' THEN
    PERFORM net.http_post(url := v_url,
      body := jsonb_build_object('kind','match_upcoming','id',NEW.id),
      headers := jsonb_build_object('Content-Type','application/json','x-push-secret',coalesce(v_secret,'')),
      timeout_milliseconds := 5000);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.queue_push_for_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  IF NEW.user_id IS NULL OR NEW.skip_push THEN RETURN NEW; END IF;

  INSERT INTO public.push_delivery_log(notification_id) VALUES (NEW.id)
  ON CONFLICT (notification_id) DO NOTHING;

  SELECT push_endpoint_url, push_webhook_secret INTO v_url, v_secret FROM public.app_settings_private WHERE id = 1;
  IF v_url IS NOT NULL AND length(trim(v_url)) > 0 THEN
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('notification_id', NEW.id),
      headers := jsonb_build_object('Content-Type','application/json','x-push-secret',coalesce(v_secret,'')),
      timeout_milliseconds := 5000);
  END IF;
  RETURN NEW;
END; $$;

-- cron jobs must send the secret too
SELECT cron.alter_job(2, command := $cmd$
  SELECT net.http_post(
    url:='https://project--195a840f-e463-4e01-855a-d90eb775f1fa.lovable.app/api/public/hooks/process-scheduled-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',(SELECT coalesce(push_webhook_secret,'') FROM public.app_settings_private WHERE id=1)),
    body:='{}'::jsonb)
$cmd$);
SELECT cron.alter_job(3, command := $cmd$
  SELECT net.http_post(
    url:='https://project--195a840f-e463-4e01-855a-d90eb775f1fa.lovable.app/api/public/hooks/recurring-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',(SELECT coalesce(push_webhook_secret,'') FROM public.app_settings_private WHERE id=1)),
    body:='{}'::jsonb)
$cmd$);

-- 2. Lock down profiles PII ---------------------------------------------------
DROP POLICY IF EXISTS "public read" ON public.profiles;
CREATE POLICY "own profile or staff read" ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);
REVOKE SELECT ON public.profiles FROM anon;

-- 3. SECURITY DEFINER function execute grants ---------------------------------
DO $$
DECLARE r record;
  anon_ok text[] := ARRAY['public_profiles','gang_directory','public_display_roles','get_display_roles',
                          'display_name_for','server_now','has_role','is_admin','resolve_special_id'];
  auth_ok text[] := ARRAY['public_profiles','gang_directory','public_display_roles','get_display_roles',
                          'display_name_for','server_now','has_role','is_admin','resolve_special_id',
                          'admin_adjust_xp','admin_award_achievement','admin_broadcast','admin_clear_leaderboard',
                          'admin_delete_bet','admin_exposure_per_match','admin_kick_user','admin_list_users_with_kyc',
                          'admin_lock_virtual_round','admin_log_action','admin_pnl_summary','admin_refund_bet',
                          'admin_resolve_virtual_round','admin_review_virtual_payout','admin_risk_summary',
                          'admin_send_gift','admin_set_virtual_cycle','admin_suspend_bet','admin_task_tier_stats',
                          'admin_toggle_match_void','admin_toggle_selection_void','admin_unsuspend_bet','admin_void_bet',
                          'apply_referral_code','approve_promo_request','cancel_championship_bet','championship_start',
                          'championship_tick','claim_challenge','claim_daily_login','create_withdrawal_request',
                          'decline_promo_request','delete_players_bulk','delete_teams_bulk','ensure_wager_wallet',
                          'house_manual_adjust','house_set_paused','p2p_accept_wager','p2p_admin_terminate',
                          'p2p_refund_wager','p2p_reject_wager','p2p_request_termination','p2p_settle_wager',
                          'p2p_verify_payment','place_championship_bet','place_real_ticket','place_virtual_ticket',
                          'place_lottery_ticket','place_lottery_ticket_multi','prune_dead_push_subscriptions',
                          'redeem_promo_code','redeem_referral_code','refund_shop_redemption','redeem_shop_item',
                          'resettle_won_bets','resolve_open_bets','review_gang_emblem','review_withdrawal_request',
                          'run_suspicious_activity_scan','search_opponents','set_tournament_result',
                          'settle_pay_winning_bet','start_user_virtual_round','user_cashout_bet',
                          'user_claim_or_settle_virtual','verify_xp_consistency','virtual_tick',
                          'virtual_wallet_admin_adjust','wipe_all_tokens','answer_trivia','claim_gift',
                          'claim_virtual_payout','dismiss_survey','submit_survey','lucky_wheel_spin',
                          'lucky_wheel_award_task_points','lucky_wheel_register_display','play_coinflip','play_scratch',
                          'play_wheel','spin_wheel','get_opponent_profile'];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
    IF r.proname = ANY(auth_ok) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    END IF;
    IF r.proname = ANY(anon_ok) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon', r.proname, r.args);
    END IF;
  END LOOP;
END $$;