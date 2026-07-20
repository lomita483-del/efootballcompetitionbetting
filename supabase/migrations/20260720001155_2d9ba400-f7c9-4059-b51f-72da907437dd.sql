
-- ============================================================================
-- P2P WAGER SYSTEM
-- ============================================================================

-- Status enum for wagers
DO $$ BEGIN
  CREATE TYPE public.wager_status AS ENUM (
    'pending_approval', 'awaiting_payment', 'awaiting_funding',
    'funded', 'active', 'live', 'awaiting_settlement',
    'settled', 'cancelled', 'refunded', 'disputed', 'terminated', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wager_payment_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wager_txn_kind AS ENUM (
    'credit_funding', 'debit_stake_lock', 'credit_payout', 'credit_refund',
    'debit_admin_adjust', 'credit_admin_adjust', 'debit_reverse_payout'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- wager_wallets
CREATE TABLE IF NOT EXISTS public.wager_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0,
  locked_balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wager_wallets TO authenticated;
GRANT ALL ON public.wager_wallets TO service_role;
ALTER TABLE public.wager_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wager wallet" ON public.wager_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ---------------------------------------------------------------- wager_wallet_txns
CREATE TABLE IF NOT EXISTS public.wager_wallet_txns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wager_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind public.wager_txn_kind NOT NULL,
  amount BIGINT NOT NULL,
  balance_after BIGINT,
  wager_id UUID,
  admin_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wager_txns_user ON public.wager_wallet_txns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wager_txns_wager ON public.wager_wallet_txns(wager_id);
GRANT SELECT ON public.wager_wallet_txns TO authenticated;
GRANT ALL ON public.wager_wallet_txns TO service_role;
ALTER TABLE public.wager_wallet_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wager txns" ON public.wager_wallet_txns FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ---------------------------------------------------------------- wagers
CREATE OR REPLACE FUNCTION public.gen_wager_public_id() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; r TEXT := ''; i INT;
BEGIN
  FOR i IN 1..6 LOOP r := r || substr(chars, floor(random()*length(chars))::int + 1, 1); END LOOP;
  RETURN 'WGR-' || r;
END $$;

CREATE TABLE IF NOT EXISTS public.wagers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL DEFAULT public.gen_wager_public_id(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  event_label TEXT,
  category TEXT NOT NULL DEFAULT 'match',
  bet_type TEXT NOT NULL DEFAULT 'winner',
  stake BIGINT NOT NULL CHECK (stake > 0),
  total_pot BIGINT NOT NULL DEFAULT 0,
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  agreement TEXT,
  status public.wager_status NOT NULL DEFAULT 'pending_approval',
  match_starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  live_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  winner_id UUID,
  loser_id UUID,
  is_draw BOOLEAN NOT NULL DEFAULT FALSE,
  final_score_home INT,
  final_score_away INT,
  prize_paid BIGINT,
  settlement_notes TEXT,
  admin_notes TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wagers_challenger ON public.wagers(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_wagers_opponent ON public.wagers(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_wagers_status ON public.wagers(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.wagers TO authenticated;
GRANT ALL ON public.wagers TO service_role;
ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wager parties can view" ON public.wagers FOR SELECT TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "challenger creates" ON public.wagers FOR INSERT TO authenticated
  WITH CHECK (challenger_id = auth.uid());
CREATE POLICY "parties respond, admin manages" ON public.wagers FOR UPDATE TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (challenger_id = auth.uid() OR opponent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.wagers REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wagers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- wager_rounds
CREATE TABLE IF NOT EXISTS public.wager_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id UUID NOT NULL REFERENCES public.wagers(id) ON DELETE CASCADE,
  round_no INT NOT NULL,
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  winner_id UUID,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wager_id, round_no)
);
GRANT SELECT ON public.wager_rounds TO authenticated;
GRANT ALL ON public.wager_rounds TO service_role;
ALTER TABLE public.wager_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rounds visible to wager parties" ON public.wager_rounds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id
    AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))));

-- ---------------------------------------------------------------- wager_payments
CREATE TABLE IF NOT EXISTS public.wager_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id UUID NOT NULL REFERENCES public.wagers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  method TEXT,
  reference TEXT,
  receipt_url TEXT,
  status public.wager_payment_status NOT NULL DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wager_payments_wager ON public.wager_payments(wager_id);
GRANT SELECT, INSERT ON public.wager_payments TO authenticated;
GRANT ALL ON public.wager_payments TO service_role;
ALTER TABLE public.wager_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin payments read" ON public.wager_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "user submits own payment" ON public.wager_payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------- wager_live_events
CREATE TABLE IF NOT EXISTS public.wager_live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id UUID NOT NULL REFERENCES public.wagers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wager_live_wager ON public.wager_live_events(wager_id, created_at DESC);
GRANT SELECT ON public.wager_live_events TO authenticated;
GRANT ALL ON public.wager_live_events TO service_role;
ALTER TABLE public.wager_live_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live events visible to wager parties" ON public.wager_live_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id
    AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))));
ALTER TABLE public.wager_live_events REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wager_live_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- wager_termination_reqs
CREATE TABLE IF NOT EXISTS public.wager_termination_reqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id UUID NOT NULL REFERENCES public.wagers(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  reason TEXT,
  opponent_response TEXT,
  opponent_response_at TIMESTAMPTZ,
  admin_status TEXT NOT NULL DEFAULT 'pending',
  admin_id UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wager_termination_reqs TO authenticated;
GRANT ALL ON public.wager_termination_reqs TO service_role;
ALTER TABLE public.wager_termination_reqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "termination visible to parties" ON public.wager_termination_reqs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id
    AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "party can request termination" ON public.wager_termination_reqs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());
CREATE POLICY "party or admin update termination" ON public.wager_termination_reqs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id
    AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ---------------------------------------------------------------- wager_disputes
CREATE TABLE IF NOT EXISTS public.wager_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id UUID NOT NULL REFERENCES public.wagers(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  admin_id UUID,
  resolution_notes TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wager_disputes TO authenticated;
GRANT ALL ON public.wager_disputes TO service_role;
ALTER TABLE public.wager_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispute visible to parties" ON public.wager_disputes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id
    AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "party opens dispute" ON public.wager_disputes FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid());
CREATE POLICY "party or admin update dispute" ON public.wager_disputes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wagers w WHERE w.id = wager_id
    AND (w.challenger_id = auth.uid() OR w.opponent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ---------------------------------------------------------------- wager_audit_log
CREATE TABLE IF NOT EXISTS public.wager_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id UUID REFERENCES public.wagers(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL,
  prev JSONB,
  next JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wager_audit_wager ON public.wager_audit_log(wager_id, created_at DESC);
GRANT SELECT ON public.wager_audit_log TO authenticated;
GRANT ALL ON public.wager_audit_log TO service_role;
ALTER TABLE public.wager_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.wager_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ============================================================================
-- Updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.wager_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_wager_wallets_touch ON public.wager_wallets;
CREATE TRIGGER trg_wager_wallets_touch BEFORE UPDATE ON public.wager_wallets
  FOR EACH ROW EXECUTE FUNCTION public.wager_touch_updated_at();

DROP TRIGGER IF EXISTS trg_wagers_touch ON public.wagers;
CREATE TRIGGER trg_wagers_touch BEFORE UPDATE ON public.wagers
  FOR EACH ROW EXECUTE FUNCTION public.wager_touch_updated_at();

DROP TRIGGER IF EXISTS trg_wager_disputes_touch ON public.wager_disputes;
CREATE TRIGGER trg_wager_disputes_touch BEFORE UPDATE ON public.wager_disputes
  FOR EACH ROW EXECUTE FUNCTION public.wager_touch_updated_at();

-- ============================================================================
-- Audit trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.wager_audit_trigger() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wager_audit_log(wager_id, actor_id, action, prev, next)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_wagers_audit ON public.wagers;
CREATE TRIGGER trg_wagers_audit AFTER INSERT OR UPDATE OR DELETE ON public.wagers
  FOR EACH ROW EXECUTE FUNCTION public.wager_audit_trigger();

-- ============================================================================
-- Ensure wager wallet exists helper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_wager_wallet(_uid UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wid UUID;
BEGIN
  SELECT id INTO wid FROM public.wager_wallets WHERE user_id = _uid;
  IF wid IS NULL THEN
    INSERT INTO public.wager_wallets(user_id) VALUES (_uid) RETURNING id INTO wid;
  END IF;
  RETURN wid;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_wager_wallet(UUID) TO authenticated, service_role;

-- ============================================================================
-- Core RPCs
-- ============================================================================

-- Accept a challenge (opponent only)
CREATE OR REPLACE FUNCTION public.p2p_accept_wager(_wager_id UUID)
RETURNS public.wagers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wagers;
BEGIN
  SELECT * INTO w FROM public.wagers WHERE id = _wager_id FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'Wager not found'; END IF;
  IF w.opponent_id <> auth.uid() THEN RAISE EXCEPTION 'Only opponent can accept'; END IF;
  IF w.status <> 'pending_approval' THEN RAISE EXCEPTION 'Wager is not pending'; END IF;
  UPDATE public.wagers SET status = 'awaiting_payment' WHERE id = _wager_id RETURNING * INTO w;
  RETURN w;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_accept_wager(UUID) TO authenticated;

-- Reject a challenge (opponent only)
CREATE OR REPLACE FUNCTION public.p2p_reject_wager(_wager_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.wagers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wagers;
BEGIN
  SELECT * INTO w FROM public.wagers WHERE id = _wager_id FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'Wager not found'; END IF;
  IF w.opponent_id <> auth.uid() AND w.challenger_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only party can reject'; END IF;
  IF w.status NOT IN ('pending_approval','awaiting_payment') THEN
    RAISE EXCEPTION 'Cannot reject at this stage'; END IF;
  UPDATE public.wagers SET status = 'rejected', settlement_notes = _reason WHERE id = _wager_id RETURNING * INTO w;
  RETURN w;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_reject_wager(UUID, TEXT) TO authenticated;

-- Admin verifies a payment → credits wager wallet + advances wager status
CREATE OR REPLACE FUNCTION public.p2p_verify_payment(_payment_id UUID)
RETURNS public.wagers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.wager_payments; w public.wagers; wid UUID; new_bal BIGINT;
        both_funded BOOLEAN;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO p FROM public.wager_payments WHERE id = _payment_id FOR UPDATE;
  IF p IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF p.status = 'verified' THEN RAISE EXCEPTION 'Already verified'; END IF;
  SELECT * INTO w FROM public.wagers WHERE id = p.wager_id FOR UPDATE;

  wid := public.ensure_wager_wallet(p.user_id);
  UPDATE public.wager_wallets SET balance = balance + p.amount WHERE id = wid
    RETURNING balance INTO new_bal;
  INSERT INTO public.wager_wallet_txns(wallet_id, user_id, kind, amount, balance_after, wager_id, admin_id, notes)
    VALUES (wid, p.user_id, 'credit_funding', p.amount, new_bal, p.wager_id, auth.uid(), 'Payment verified');

  -- Lock stake immediately into the wager
  UPDATE public.wager_wallets SET balance = balance - w.stake, locked_balance = locked_balance + w.stake
    WHERE id = wid RETURNING balance INTO new_bal;
  INSERT INTO public.wager_wallet_txns(wallet_id, user_id, kind, amount, balance_after, wager_id, admin_id, notes)
    VALUES (wid, p.user_id, 'debit_stake_lock', -w.stake, new_bal, p.wager_id, auth.uid(), 'Stake locked into wager');

  UPDATE public.wager_payments
    SET status = 'verified', verified_by = auth.uid(), verified_at = now()
    WHERE id = _payment_id;

  -- Check if both sides funded now
  SELECT
    EXISTS (SELECT 1 FROM public.wager_payments WHERE wager_id = w.id AND user_id = w.challenger_id AND status = 'verified')
    AND
    EXISTS (SELECT 1 FROM public.wager_payments WHERE wager_id = w.id AND user_id = w.opponent_id AND status = 'verified')
    INTO both_funded;

  IF both_funded THEN
    UPDATE public.wagers
      SET status = 'active', funded_at = now(), activated_at = now(),
          total_pot = w.stake * 2
      WHERE id = w.id
      RETURNING * INTO w;
  ELSE
    UPDATE public.wagers SET status = 'awaiting_funding' WHERE id = w.id RETURNING * INTO w;
  END IF;
  RETURN w;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_verify_payment(UUID) TO authenticated;

-- Admin settles a wager
CREATE OR REPLACE FUNCTION public.p2p_settle_wager(
  _wager_id UUID, _winner_id UUID, _is_draw BOOLEAN DEFAULT FALSE,
  _final_home INT DEFAULT NULL, _final_away INT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS public.wagers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wagers; pot BIGINT; fee BIGINT; prize BIGINT; wid_ch UUID; wid_op UUID;
        new_bal BIGINT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO w FROM public.wagers WHERE id = _wager_id FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'Wager not found'; END IF;
  IF w.status NOT IN ('active','live','awaiting_settlement') THEN
    RAISE EXCEPTION 'Wager cannot be settled from status %', w.status; END IF;

  pot := w.stake * 2;
  fee := (pot * COALESCE(w.platform_fee_pct, 0) / 100)::BIGINT;
  prize := pot - fee;

  wid_ch := public.ensure_wager_wallet(w.challenger_id);
  wid_op := public.ensure_wager_wallet(w.opponent_id);

  -- Release both locked stakes
  UPDATE public.wager_wallets SET locked_balance = locked_balance - w.stake WHERE id = wid_ch;
  UPDATE public.wager_wallets SET locked_balance = locked_balance - w.stake WHERE id = wid_op;

  IF _is_draw THEN
    -- Split prize evenly
    UPDATE public.wager_wallets SET balance = balance + (prize/2) WHERE id = wid_ch RETURNING balance INTO new_bal;
    INSERT INTO public.wager_wallet_txns(wallet_id,user_id,kind,amount,balance_after,wager_id,admin_id,notes)
      VALUES (wid_ch, w.challenger_id, 'credit_payout', prize/2, new_bal, w.id, auth.uid(), 'Draw split');
    UPDATE public.wager_wallets SET balance = balance + (prize - prize/2) WHERE id = wid_op RETURNING balance INTO new_bal;
    INSERT INTO public.wager_wallet_txns(wallet_id,user_id,kind,amount,balance_after,wager_id,admin_id,notes)
      VALUES (wid_op, w.opponent_id, 'credit_payout', prize - prize/2, new_bal, w.id, auth.uid(), 'Draw split');
    UPDATE public.wagers SET status='settled', settled_at=now(), is_draw=TRUE,
      winner_id=NULL, loser_id=NULL, prize_paid=prize,
      final_score_home=_final_home, final_score_away=_final_away, settlement_notes=_notes
      WHERE id=w.id RETURNING * INTO w;
  ELSE
    IF _winner_id NOT IN (w.challenger_id, w.opponent_id) THEN
      RAISE EXCEPTION 'Winner must be a party of the wager'; END IF;
    DECLARE wwid UUID; loser UUID;
    BEGIN
      wwid := CASE WHEN _winner_id = w.challenger_id THEN wid_ch ELSE wid_op END;
      loser := CASE WHEN _winner_id = w.challenger_id THEN w.opponent_id ELSE w.challenger_id END;
      UPDATE public.wager_wallets SET balance = balance + prize WHERE id = wwid RETURNING balance INTO new_bal;
      INSERT INTO public.wager_wallet_txns(wallet_id,user_id,kind,amount,balance_after,wager_id,admin_id,notes)
        VALUES (wwid, _winner_id, 'credit_payout', prize, new_bal, w.id, auth.uid(), 'Wager payout');
      UPDATE public.wagers SET status='settled', settled_at=now(), is_draw=FALSE,
        winner_id=_winner_id, loser_id=loser, prize_paid=prize,
        final_score_home=_final_home, final_score_away=_final_away, settlement_notes=_notes
        WHERE id=w.id RETURNING * INTO w;
    END;
  END IF;
  RETURN w;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_settle_wager(UUID,UUID,BOOLEAN,INT,INT,TEXT) TO authenticated;

-- Admin refunds a wager (both sides)
CREATE OR REPLACE FUNCTION public.p2p_refund_wager(_wager_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.wagers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wagers; wid_ch UUID; wid_op UUID; new_bal BIGINT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO w FROM public.wagers WHERE id = _wager_id FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'Wager not found'; END IF;
  wid_ch := public.ensure_wager_wallet(w.challenger_id);
  wid_op := public.ensure_wager_wallet(w.opponent_id);
  -- refund locked stakes back to balance
  IF w.status IN ('funded','active','live','awaiting_settlement','disputed') THEN
    UPDATE public.wager_wallets SET locked_balance = locked_balance - w.stake, balance = balance + w.stake WHERE id = wid_ch RETURNING balance INTO new_bal;
    INSERT INTO public.wager_wallet_txns(wallet_id,user_id,kind,amount,balance_after,wager_id,admin_id,notes)
      VALUES (wid_ch, w.challenger_id, 'credit_refund', w.stake, new_bal, w.id, auth.uid(), COALESCE(_reason,'Refund'));
    UPDATE public.wager_wallets SET locked_balance = locked_balance - w.stake, balance = balance + w.stake WHERE id = wid_op RETURNING balance INTO new_bal;
    INSERT INTO public.wager_wallet_txns(wallet_id,user_id,kind,amount,balance_after,wager_id,admin_id,notes)
      VALUES (wid_op, w.opponent_id, 'credit_refund', w.stake, new_bal, w.id, auth.uid(), COALESCE(_reason,'Refund'));
  END IF;
  UPDATE public.wagers SET status='refunded', settlement_notes=_reason WHERE id=w.id RETURNING * INTO w;
  RETURN w;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_refund_wager(UUID,TEXT) TO authenticated;

-- Termination request
CREATE OR REPLACE FUNCTION public.p2p_request_termination(_wager_id UUID, _reason TEXT)
RETURNS public.wager_termination_reqs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wagers; r public.wager_termination_reqs;
BEGIN
  SELECT * INTO w FROM public.wagers WHERE id = _wager_id;
  IF w IS NULL THEN RAISE EXCEPTION 'Wager not found'; END IF;
  IF auth.uid() NOT IN (w.challenger_id, w.opponent_id) THEN RAISE EXCEPTION 'Not a party'; END IF;
  INSERT INTO public.wager_termination_reqs(wager_id, requested_by, reason)
    VALUES (_wager_id, auth.uid(), _reason) RETURNING * INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_request_termination(UUID,TEXT) TO authenticated;

-- Admin emergency terminate
CREATE OR REPLACE FUNCTION public.p2p_admin_terminate(_wager_id UUID, _reason TEXT, _refund BOOLEAN DEFAULT TRUE)
RETURNS public.wagers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wagers;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Admin only'; END IF;
  IF _refund THEN
    PERFORM public.p2p_refund_wager(_wager_id, _reason);
  END IF;
  UPDATE public.wagers SET status='terminated', settlement_notes=_reason WHERE id=_wager_id RETURNING * INTO w;
  RETURN w;
END $$;
GRANT EXECUTE ON FUNCTION public.p2p_admin_terminate(UUID,TEXT,BOOLEAN) TO authenticated;
