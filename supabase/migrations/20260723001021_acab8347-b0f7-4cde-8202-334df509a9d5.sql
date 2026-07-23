-- Keep one authoritative void-toggle signature and recalculate unsettled voucher totals immediately.
DROP FUNCTION IF EXISTS public.admin_toggle_selection_void(uuid, boolean);

CREATE OR REPLACE FUNCTION public.recalculate_open_bet_totals(_bet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stake numeric;
  v_effective_odds numeric;
BEGIN
  SELECT stake INTO v_stake
  FROM public.bets
  WHERE id = _bet_id AND status IN ('open', 'suspended')
  FOR UPDATE;

  IF v_stake IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(EXP(SUM(LN(NULLIF(bs.locked_odds, 0)))) FILTER (WHERE bs.result IS DISTINCT FROM 'void'), 1)
    INTO v_effective_odds
    FROM public.bet_selections bs
   WHERE bs.bet_id = _bet_id;

  UPDATE public.bets
     SET total_odds = ROUND(COALESCE(v_effective_odds, 1), 2),
         potential_payout = GREATEST(v_stake, ROUND(v_stake * COALESCE(v_effective_odds, 1)))
   WHERE id = _bet_id
     AND status IN ('open', 'suspended');
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_open_bet_totals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_open_bet_totals(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_toggle_selection_void(_bet_id uuid, _selection_id uuid, _void boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_void boolean;
  v_match_status public.match_status;
  v_is_winner boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bet_selections
    WHERE id = _selection_id AND bet_id = _bet_id
  ) THEN
    RAISE EXCEPTION 'Selection is not part of this voucher';
  END IF;

  IF _void THEN
    UPDATE public.bet_selections
       SET result = 'void'
     WHERE id = _selection_id AND bet_id = _bet_id;
  ELSE
    SELECT COALESCE(m.is_void, false), m.status, o.is_winner
      INTO v_match_void, v_match_status, v_is_winner
      FROM public.bet_selections bs
      LEFT JOIN public.matches m ON m.id = bs.match_id
      LEFT JOIN public.odds o ON o.id = bs.odd_id
     WHERE bs.id = _selection_id AND bs.bet_id = _bet_id;

    IF v_match_void THEN
      RAISE EXCEPTION 'This match is globally void. Unvoid the match first.';
    END IF;

    UPDATE public.bet_selections
       SET result = CASE
         WHEN v_match_status = 'ended' AND v_is_winner IS TRUE THEN 'won'
         WHEN v_match_status = 'ended' AND EXISTS (
           SELECT 1
           FROM public.bet_selections bs2
           JOIN public.odds o2 ON o2.market_id = bs2.market_id
           WHERE bs2.id = _selection_id AND o2.is_winner IS TRUE
         ) THEN 'lost'
         ELSE NULL
       END
     WHERE id = _selection_id AND bet_id = _bet_id;
  END IF;

  PERFORM public.recalculate_open_bet_totals(_bet_id);

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (
    auth.uid(),
    CASE WHEN _void THEN 'void_selection' ELSE 'unvoid_selection' END,
    'bet_selection',
    _selection_id::text,
    jsonb_build_object('bet_id', _bet_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_selection_void(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_selection_void(uuid, uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_match_void_selections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id uuid;
BEGIN
  IF NEW.is_void IS DISTINCT FROM OLD.is_void THEN
    IF NEW.is_void THEN
      UPDATE public.bet_selections
         SET result = 'void'
       WHERE match_id = NEW.id
         AND (result IS NULL OR result IN ('lost', 'won'));
    ELSE
      UPDATE public.bet_selections bs
         SET result = CASE
           WHEN NEW.status = 'ended' AND o.is_winner IS TRUE THEN 'won'
           WHEN NEW.status = 'ended' AND EXISTS (
             SELECT 1 FROM public.odds winner
             WHERE winner.market_id = bs.market_id AND winner.is_winner IS TRUE
           ) THEN 'lost'
           ELSE NULL
         END
        FROM public.odds o
       WHERE bs.match_id = NEW.id
         AND bs.result = 'void'
         AND o.id = bs.odd_id;
    END IF;

    FOR v_bet_id IN
      SELECT DISTINCT bet_id FROM public.bet_selections WHERE match_id = NEW.id
    LOOP
      PERFORM public.recalculate_open_bet_totals(v_bet_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_match_void_selections() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_match_void_selections() TO service_role;

-- Validate wager proof submissions at the database boundary.
CREATE OR REPLACE FUNCTION public.validate_wager_payment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wager public.wagers;
BEGIN
  SELECT * INTO v_wager FROM public.wagers WHERE id = NEW.wager_id;
  IF v_wager.id IS NULL THEN
    RAISE EXCEPTION 'Wager not found';
  END IF;
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own payment';
  END IF;
  IF NEW.user_id NOT IN (v_wager.challenger_id, v_wager.opponent_id) THEN
    RAISE EXCEPTION 'You are not a party to this wager';
  END IF;
  IF v_wager.status NOT IN ('awaiting_payment', 'awaiting_funding') THEN
    RAISE EXCEPTION 'This wager is not accepting payments';
  END IF;
  IF NEW.amount <> v_wager.stake THEN
    RAISE EXCEPTION 'Payment amount must equal the wager stake';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_wager_payment_submission ON public.wager_payments;
CREATE TRIGGER trg_validate_wager_payment_submission
BEFORE INSERT ON public.wager_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_wager_payment_submission();

REVOKE ALL ON FUNCTION public.validate_wager_payment_submission() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_wager_payment_submission() TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS wager_payments_one_per_user_wager
ON public.wager_payments(wager_id, user_id);

CREATE OR REPLACE FUNCTION public.p2p_verify_payment(_payment_id uuid)
RETURNS public.wagers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.wager_payments;
  w public.wagers;
  wid uuid;
  new_bal bigint;
  both_funded boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO p FROM public.wager_payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT * INTO w FROM public.wagers WHERE id = p.wager_id FOR UPDATE;
  IF w.id IS NULL THEN
    RAISE EXCEPTION 'Wager not found';
  END IF;
  IF w.status NOT IN ('awaiting_payment', 'awaiting_funding', 'active') THEN
    RAISE EXCEPTION 'Wager cannot be funded from status %', w.status;
  END IF;
  IF p.user_id NOT IN (w.challenger_id, w.opponent_id) THEN
    RAISE EXCEPTION 'Payment user is not a wager party';
  END IF;
  IF p.amount <> w.stake THEN
    RAISE EXCEPTION 'Payment amount does not match the wager stake';
  END IF;

  IF p.status <> 'verified' THEN
    wid := public.ensure_wager_wallet(p.user_id);
    UPDATE public.wager_wallets
       SET balance = balance + p.amount
     WHERE id = wid
     RETURNING balance INTO new_bal;
    INSERT INTO public.wager_wallet_txns(wallet_id, user_id, kind, amount, balance_after, wager_id, admin_id, notes)
    VALUES (wid, p.user_id, 'credit_funding', p.amount, new_bal, p.wager_id, auth.uid(), 'Payment verified');

    UPDATE public.wager_wallets
       SET balance = balance - w.stake,
           locked_balance = locked_balance + w.stake
     WHERE id = wid AND balance >= w.stake
     RETURNING balance INTO new_bal;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unable to lock wager stake';
    END IF;
    INSERT INTO public.wager_wallet_txns(wallet_id, user_id, kind, amount, balance_after, wager_id, admin_id, notes)
    VALUES (wid, p.user_id, 'debit_stake_lock', -w.stake, new_bal, p.wager_id, auth.uid(), 'Stake locked into wager');

    UPDATE public.wager_payments
       SET status = 'verified', verified_by = auth.uid(), verified_at = now()
     WHERE id = _payment_id;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.wager_payments WHERE wager_id = w.id AND user_id = w.challenger_id AND status = 'verified')
    AND EXISTS (SELECT 1 FROM public.wager_payments WHERE wager_id = w.id AND user_id = w.opponent_id AND status = 'verified')
    INTO both_funded;

  IF both_funded THEN
    UPDATE public.wagers
       SET status = 'active', funded_at = COALESCE(funded_at, now()), activated_at = COALESCE(activated_at, now()), total_pot = stake * 2
     WHERE id = w.id
     RETURNING * INTO w;
  ELSE
    UPDATE public.wagers SET status = 'awaiting_funding' WHERE id = w.id RETURNING * INTO w;
  END IF;

  RETURN w;
END;
$$;

REVOKE ALL ON FUNCTION public.p2p_verify_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.p2p_verify_payment(uuid) TO authenticated, service_role;

-- Backfill unsettled voucher display totals after historical voids.
DO $$
DECLARE v_bet_id uuid;
BEGIN
  FOR v_bet_id IN
    SELECT DISTINCT bet_id
    FROM public.bet_selections
    WHERE result = 'void'
  LOOP
    PERFORM public.recalculate_open_bet_totals(v_bet_id);
  END LOOP;
END;
$$;