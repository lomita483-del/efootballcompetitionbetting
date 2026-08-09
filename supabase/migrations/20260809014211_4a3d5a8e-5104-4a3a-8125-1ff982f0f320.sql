CREATE OR REPLACE FUNCTION public.task_bump_metric(_user_id uuid, _metric text, _delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _delta IS NULL THEN RETURN; END IF;
  PERFORM public.task_bump_metric(_user_id, _metric, floor(_delta)::bigint);
END;
$$;

GRANT EXECUTE ON FUNCTION public.task_bump_metric(uuid, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.task_bump_metric(uuid, text, bigint) TO authenticated, service_role;