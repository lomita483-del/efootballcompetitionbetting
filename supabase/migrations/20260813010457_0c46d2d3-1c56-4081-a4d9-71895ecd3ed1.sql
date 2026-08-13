
CREATE OR REPLACE FUNCTION public.public_display_roles(_ids uuid[])
RETURNS TABLE(user_id uuid, roles text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.user_id, array_agg(ur.role::text)
  FROM public.user_roles ur
  WHERE ur.user_id = ANY(_ids)
    AND ur.role::text IN ('admin','moderator','sponsor','gang_leader')
  GROUP BY ur.user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.public_display_roles(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.public_display_roles(uuid[]) TO authenticated;
