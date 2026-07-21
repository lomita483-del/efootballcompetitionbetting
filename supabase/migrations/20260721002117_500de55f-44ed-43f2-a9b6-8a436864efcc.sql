
-- 1) Void column on matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_void boolean NOT NULL DEFAULT false;

-- Trigger: sync selection results when a match is voided / un-voided
CREATE OR REPLACE FUNCTION public.sync_match_void_selections()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_void IS DISTINCT FROM OLD.is_void THEN
    IF NEW.is_void THEN
      UPDATE public.bet_selections SET result='void' WHERE match_id = NEW.id AND (result IS NULL OR result IN ('lost','won'));
    ELSE
      UPDATE public.bet_selections SET result=NULL WHERE match_id = NEW.id AND result='void';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_match_void ON public.matches;
CREATE TRIGGER trg_sync_match_void AFTER UPDATE OF is_void ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.sync_match_void_selections();

-- 2) Admin RPC: toggle void on a single selection of a specific voucher
CREATE OR REPLACE FUNCTION public.admin_toggle_selection_void(_bet_id uuid, _selection_id uuid, _void boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.bet_selections SET result = CASE WHEN _void THEN 'void' ELSE NULL END
   WHERE id = _selection_id AND bet_id = _bet_id;
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), CASE WHEN _void THEN 'void_selection' ELSE 'unvoid_selection' END,
            'bet_selection', _selection_id::text, jsonb_build_object('bet_id', _bet_id));
END $$;

-- 3) Smarter resolver: don't mark selections lost unless the market has an actual declared winner
CREATE OR REPLACE FUNCTION public.resolve_open_bets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  b RECORD;
  n INT := 0;
  cfg RECORD;
  payout_amount BIGINT;
  is_virt BOOLEAN;
  unresolved INT;
  has_lost BOOLEAN;
  all_void BOOLEAN;
  effective_payout BIGINT;
  void_factor NUMERIC;
BEGIN
  SELECT virtual_payout_multiplier, virtual_win_bonus_tokens INTO cfg FROM public.app_settings WHERE id = 1;

  FOR b IN
    SELECT bt.* FROM public.bets bt
     WHERE bt.status='open' AND bt.championship_bet_id IS NULL
       AND EXISTS (SELECT 1 FROM public.bet_selections bs WHERE bs.bet_id = bt.id)
  LOOP
    -- Void selection if match is void
    UPDATE public.bet_selections bs SET result='void'
      FROM public.matches mt
     WHERE bs.bet_id = b.id AND bs.match_id = mt.id AND mt.is_void = true AND (bs.result IS NULL OR bs.result IN ('lost','won'));

    -- Only fill result for markets that have a declared winner (some odd is_winner=true)
    UPDATE public.bet_selections bs
       SET result = CASE WHEN o.is_winner IS TRUE THEN 'won' ELSE 'lost' END
      FROM public.odds o, public.matches mt
     WHERE bs.bet_id = b.id AND bs.odd_id = o.id AND bs.match_id = mt.id
       AND mt.status = 'ended' AND mt.is_void = false AND bs.result IS NULL
       AND EXISTS (SELECT 1 FROM public.odds o2 WHERE o2.market_id = o.market_id AND o2.is_winner = true);

    SELECT COUNT(*) FILTER (WHERE bs2.result IS NULL),
           COALESCE(bool_or(bs2.result = 'lost'), false),
           COALESCE(bool_and(bs2.result = 'void'), false)
      INTO unresolved, has_lost, all_void
      FROM public.bet_selections bs2 WHERE bs2.bet_id = b.id;

    IF has_lost THEN
      UPDATE public.bets SET status='lost', cashout_amount=0, settled_at=COALESCE(settled_at, now())
       WHERE id = b.id AND status='open';
      INSERT INTO public.notifications (user_id, title, body, link)
        VALUES (b.user_id, 'Bet lost', 'Your ticket ' || b.tracking_id || ' did not win this round.', '/ticket/' || b.id::text);
      n := n + 1;
    ELSIF unresolved = 0 THEN
      IF all_void THEN
        UPDATE public.bets SET status='void', cashout_amount=b.stake, settled_at=COALESCE(settled_at, now())
         WHERE id = b.id AND status='open';
        UPDATE public.profiles SET token_balance = token_balance + b.stake WHERE id = b.user_id;
        INSERT INTO public.notifications (user_id, title, body, link)
          VALUES (b.user_id, 'Bet voided', b.tracking_id || ' was voided; stake returned.', '/ticket/' || b.id::text);
      ELSE
        -- Adjust payout: void selections drop out of the multiplier
        SELECT COALESCE(EXP(SUM(LN(NULLIF(bs.locked_odds, 0)))) FILTER (WHERE bs.result <> 'void'), 1)
             / NULLIF(b.total_odds, 0)
          INTO void_factor
          FROM public.bet_selections bs WHERE bs.bet_id = b.id;
        effective_payout := GREATEST(b.stake, ROUND(b.stake * (b.total_odds * COALESCE(void_factor,1))))::bigint;

        SELECT COALESCE(bool_or(mt.is_virtual), false) INTO is_virt
          FROM public.bet_selections bs3 JOIN public.matches mt ON mt.id = bs3.match_id WHERE bs3.bet_id = b.id;
        UPDATE public.bets SET status='won', cashout_amount=effective_payout, settled_at=COALESCE(settled_at, now())
         WHERE id = b.id AND status='open';
        IF is_virt THEN
          payout_amount := (effective_payout * COALESCE(cfg.virtual_payout_multiplier,1.0))::bigint + COALESCE(cfg.virtual_win_bonus_tokens,0);
          INSERT INTO public.virtual_payout_requests(bet_id, user_id, match_id, stake, amount, status)
            SELECT b.id, b.user_id, bs.match_id, b.stake, payout_amount, 'pending'
              FROM public.bet_selections bs WHERE bs.bet_id = b.id LIMIT 1
            ON CONFLICT (bet_id) DO NOTHING;
          INSERT INTO public.notifications (user_id, title, body, link)
            VALUES (b.user_id, 'Virtual ticket won — claim now',
                    b.tracking_id || ' is eligible for a ' || payout_amount::text || ' token payout.', '/virtual/history');
        ELSE
          UPDATE public.profiles SET token_balance = token_balance + effective_payout WHERE id = b.user_id;
          INSERT INTO public.token_transactions (user_id, amount, kind, description)
            VALUES (b.user_id, effective_payout, 'bet_won', 'Win ' || b.tracking_id) ON CONFLICT DO NOTHING;
          INSERT INTO public.notifications (user_id, title, body, link)
            VALUES (b.user_id, 'Ticket won', b.tracking_id || ' paid ' || effective_payout::text || ' tokens.', '/ticket/' || b.id::text);
        END IF;
      END IF;
      n := n + 1;
    END IF;
  END LOOP;

  n := n + COALESCE(public.resolve_auto_championship(), 0);
  RETURN n;
END $$;

-- 4) Wager dispute messages (chat + evidence)
CREATE TABLE IF NOT EXISTS public.wager_dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.wager_disputes(id) ON DELETE CASCADE,
  wager_id uuid NOT NULL REFERENCES public.wagers(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'player',
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wager_dispute_messages TO authenticated;
GRANT ALL ON public.wager_dispute_messages TO service_role;

ALTER TABLE public.wager_dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispute members and admins can read messages"
  ON public.wager_dispute_messages FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.wagers w
       WHERE w.id = wager_id
         AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid())
    )
  );

CREATE POLICY "dispute members and admins can post messages"
  ON public.wager_dispute_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.wagers w
         WHERE w.id = wager_id
           AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid())
      )
    )
  );
