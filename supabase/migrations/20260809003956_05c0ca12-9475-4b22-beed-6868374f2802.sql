-- Analytics session id drifted to uuid; app sends a text session key
ALTER TABLE public.analytics_events ALTER COLUMN session_id TYPE text USING session_id::text;

-- Helper: dedupe then add unique index
DO $$
DECLARE
  r record;
  specs text[][] := ARRAY[
    ARRAY['survey_responses','survey_id, user_id'],
    ARRAY['poll_votes','poll_id, user_id'],
    ARRAY['trivia_attempts','user_id, question_id'],
    ARRAY['highlight_reactions','highlight_id, user_id'],
    ARRAY['chat_message_reactions','message_id, user_id, emoji'],
    ARRAY['chat_message_flags','message_id, reporter_id'],
    ARRAY['user_achievements','user_id, code'],
    ARRAY['user_task_progress','user_id, tier_id'],
    ARRAY['user_challenge_progress','user_id, challenge_id'],
    ARRAY['championship_bets','user_id, tournament_id'],
    ARRAY['wager_payments','wager_id, user_id'],
    ARRAY['wager_rounds','wager_id, round_no'],
    ARRAY['lucky_wheel_user_state','campaign_id, user_id'],
    ARRAY['leaderboard_rewards','leaderboard_type, rank'],
    ARRAY['leaderboard_overrides','board, name'],
    ARRAY['promo_redemptions','promo_id, user_id'],
    ARRAY['notification_prefs','user_id'],
    ARRAY['push_subscriptions','endpoint'],
    ARRAY['push_delivery_log','notification_id'],
    ARRAY['profiles','special_id'],
    ARRAY['flag_rules','rule_key'],
    ARRAY['recurring_push_settings','kind, idx'],
    ARRAY['season_points','user_id, season_id'],
    ARRAY['virtual_payout_requests','bet_id'],
    ARRAY['user_tasks','user_id, task_id'],
    ARRAY['referrals','referred_id']
  ];
  tbl text; cols text; idxname text; colcheck boolean;
BEGIN
  FOR i IN 1..array_length(specs,1) LOOP
    tbl := specs[i][1];
    cols := specs[i][2];
    idxname := 'uniq_' || tbl || '_' || regexp_replace(cols, '[^a-z0-9]+', '_', 'g');
    -- table exists?
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                   WHERE n.nspname='public' AND c.relname=tbl AND c.relkind='r') THEN
      CONTINUE;
    END IF;
    -- all columns exist?
    SELECT bool_and(EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema='public' AND table_name=tbl AND column_name=trim(c)))
      INTO colcheck
      FROM unnest(string_to_array(cols, ',')) AS c;
    IF NOT colcheck THEN CONTINUE; END IF;
    -- already covered by a unique index?
    IF EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid=ix.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='public' AND t.relname=tbl AND ix.indisunique
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
             FROM unnest(ix.indkey) k JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k)
            = (SELECT array_agg(trim(c) ORDER BY trim(c)) FROM unnest(string_to_array(cols, ',')) c)
    ) THEN CONTINUE; END IF;
    -- dedupe: keep the newest row per key (fallback to ctid ordering)
    EXECUTE format(
      'DELETE FROM public.%1$I t USING (
         SELECT ctid, row_number() OVER (PARTITION BY %2$s ORDER BY ctid DESC) rn
         FROM public.%1$I
       ) d WHERE t.ctid = d.ctid AND d.rn > 1', tbl, cols);
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (%s)', idxname, tbl, cols);
  END LOOP;
END $$;