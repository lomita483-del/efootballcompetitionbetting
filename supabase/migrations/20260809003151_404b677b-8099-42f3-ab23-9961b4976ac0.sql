-- 1) Profile creation on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Protect sensitive profile fields from direct client updates
DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 3) Realtime: replica identity + publication membership
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'advertisements','app_settings','ban_appeals','bet_selections','bets','big_wins',
    'casino_plays','challenges','championship_bets','chat_message_flags','chat_message_reactions',
    'chat_messages','events','floating_widgets','house_transactions','house_wallet',
    'leaderboard_overrides','lottery_draws','lottery_tickets','lucky_wheel_spins','markets',
    'matches','mcp_audit_logs','news','notifications','odds','players','polls','profiles',
    'promo_code_requests','seasons','spotlights','support_tickets','surveys','teams',
    'ticket_messages','token_requests','token_transactions','tournament_matches',
    'tournament_participants','tournaments','user_achievements','user_challenge_progress',
    'user_gifts','user_roles','user_task_progress','user_tasks','virtual_house_transactions',
    'virtual_house_wallet','virtual_payout_requests','wager_dispute_messages','wager_disputes',
    'wager_live_events','wager_payments','wager_wallets','wagers','withdrawal_requests'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;