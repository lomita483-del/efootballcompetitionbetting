CREATE OR REPLACE FUNCTION public.resolve_open_bets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  n integer := 0;
  cfg record;
  payout_amount bigint;
  is_virt boolean;
  unresolved integer;
  has_lost boolean;
  all_void boolean;
  effective_payout bigint;
  effective_odds numeric;
BEGIN
  SELECT virtual_payout_multiplier, virtual_win_bonus_tokens
    INTO cfg
    FROM public.app_settings
   WHERE id = 1;

  FOR b IN
    SELECT bt.*
      FROM public.bets bt
     WHERE bt.status = 'open'
       AND bt.championship_bet_id IS NULL
       AND EXISTS (SELECT 1 FROM public.bet_selections bs WHERE bs.bet_id = bt.id)
  LOOP
    UPDATE public.bet_selections bs
       SET result = 'void'
      FROM public.matches mt
     WHERE bs.bet_id = b.id
       AND bs.match_id = mt.id
       AND mt.is_void = true
       AND (bs.result IS NULL OR bs.result IN ('lost', 'won'));

    UPDATE public.bet_selections bs
       SET result = NULL
      FROM public.matches mt
     WHERE bs.bet_id = b.id
       AND bs.match_id = mt.id
       AND mt.is_void = false
       AND mt.status IS DISTINCT FROM 'ended'
       AND bs.result IN ('lost', 'won');

    UPDATE public.bet_selections bs
       SET result = CASE WHEN o.is_winner IS TRUE THEN 'won' ELSE 'lost' END
      FROM public.odds o, public.matches mt
     WHERE bs.bet_id = b.id
       AND bs.odd_id = o.id
       AND bs.match_id = mt.id
       AND mt.status = 'ended'
       AND mt.is_void = false
       AND bs.result IS NULL
       AND EXISTS (
         SELECT 1 FROM public.odds o2
         WHERE o2.market_id = o.market_id AND o2.is_winner = true
       );

    PERFORM public.recalculate_open_bet_totals(b.id);

    SELECT COUNT(*) FILTER (WHERE bs2.result IS NULL),
           COALESCE(bool_or(bs2.result = 'lost' AND mt.status = 'ended' AND mt.is_void = false), false),
           COALESCE(bool_and(bs2.result = 'void'), false)
      INTO unresolved, has_lost, all_void
      FROM public.bet_selections bs2
      JOIN public.matches mt ON mt.id = bs2.match_id
     WHERE bs2.bet_id = b.id;

    IF has_lost THEN
      UPDATE public.bets
         SET status = 'lost', cashout_amount = 0, settled_at = COALESCE(settled_at, now())
       WHERE id = b.id AND status = 'open';
      INSERT INTO public.notifications(user_id, title, body, link)
      VALUES (b.user_id, 'Bet lost', 'Your ticket ' || b.tracking_id || ' did not win this round.', '/ticket/' || b.id::text);
      n := n + 1;
    ELSIF unresolved = 0 THEN
      IF all_void THEN
        UPDATE public.bets
           SET status = 'void', total_odds = 1, potential_payout = b.stake,
               cashout_amount = b.stake, settled_at = COALESCE(settled_at, now())
         WHERE id = b.id AND status = 'open';
        UPDATE public.profiles SET token_balance = token_balance + b.stake WHERE id = b.user_id;
        INSERT INTO public.notifications(user_id, title, body, link)
        VALUES (b.user_id, 'Bet voided', b.tracking_id || ' was voided; stake returned.', '/ticket/' || b.id::text);
      ELSE
        SELECT COALESCE(EXP(SUM(LN(NULLIF(bs.locked_odds, 0)))) FILTER (WHERE bs.result IS DISTINCT FROM 'void'), 1)
          INTO effective_odds
          FROM public.bet_selections bs
         WHERE bs.bet_id = b.id;
        effective_payout := GREATEST(b.stake, ROUND(b.stake * COALESCE(effective_odds, 1)))::bigint;

        SELECT COALESCE(bool_or(mt.is_virtual), false)
          INTO is_virt
          FROM public.bet_selections bs3
          JOIN public.matches mt ON mt.id = bs3.match_id
         WHERE bs3.bet_id = b.id;

        UPDATE public.bets
           SET status = 'won', total_odds = ROUND(COALESCE(effective_odds, 1), 2),
               potential_payout = effective_payout, cashout_amount = effective_payout,
               settled_at = COALESCE(settled_at, now())
         WHERE id = b.id AND status = 'open';

        IF is_virt THEN
          payout_amount := (effective_payout * COALESCE(cfg.virtual_payout_multiplier, 1.0))::bigint
                           + COALESCE(cfg.virtual_win_bonus_tokens, 0);
          INSERT INTO public.virtual_payout_requests(bet_id, user_id, match_id, stake, amount, status)
          SELECT b.id, b.user_id, bs.match_id, b.stake, payout_amount, 'pending'
            FROM public.bet_selections bs
           WHERE bs.bet_id = b.id
           LIMIT 1
          ON CONFLICT (bet_id) DO NOTHING;
          INSERT INTO public.notifications(user_id, title, body, link)
          VALUES (b.user_id, 'Virtual ticket won — claim now',
                  b.tracking_id || ' is eligible for a ' || payout_amount::text || ' token payout.', '/virtual/history');
        ELSE
          UPDATE public.profiles SET token_balance = token_balance + effective_payout WHERE id = b.user_id;
          INSERT INTO public.token_transactions(user_id, amount, kind, description)
          VALUES (b.user_id, effective_payout, 'bet_won', 'Win ' || b.tracking_id)
          ON CONFLICT DO NOTHING;
          INSERT INTO public.notifications(user_id, title, body, link)
          VALUES (b.user_id, 'Ticket won', b.tracking_id || ' paid ' || effective_payout::text || ' tokens.', '/ticket/' || b.id::text);
        END IF;
      END IF;
      n := n + 1;
    END IF;
  END LOOP;

  n := n + COALESCE(public.resolve_auto_championship(), 0);
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_open_bets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_open_bets() TO service_role;