CREATE OR REPLACE FUNCTION public.admin_toggle_match_void(_match_id uuid, _void boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.matches SET is_void = _void WHERE id = _match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  FOR v_bet_id IN
    SELECT DISTINCT bet_id FROM public.bet_selections WHERE match_id = _match_id
  LOOP
    PERFORM public.recalculate_open_bet_totals(v_bet_id);
  END LOOP;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), CASE WHEN _void THEN 'match_void' ELSE 'match_unvoid' END, 'match', _match_id, jsonb_build_object('reason', _reason));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_match_void(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_match_void(uuid, boolean, text) TO authenticated, service_role;