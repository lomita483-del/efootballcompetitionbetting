
CREATE OR REPLACE FUNCTION public.search_opponents(_q text)
RETURNS TABLE(id uuid, full_name text, email text, special_id text, avatar_url text, discord_username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.special_id, p.avatar_url, p.discord_username
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND p.id <> auth.uid()
     AND p.is_banned = false
     AND (
       p.full_name ILIKE '%' || _q || '%'
       OR p.email ILIKE '%' || _q || '%'
       OR COALESCE(p.discord_username,'') ILIKE '%' || _q || '%'
       OR COALESCE(p.ingame_name,'') ILIKE '%' || _q || '%'
       OR COALESCE(p.special_id,'') ILIKE '%' || _q || '%'
       OR p.id::text = _q
     )
   ORDER BY p.full_name
   LIMIT 10
$$;

REVOKE ALL ON FUNCTION public.search_opponents(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_opponents(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_opponent_profile(_id uuid)
RETURNS TABLE(id uuid, full_name text, email text, special_id text, avatar_url text, discord_username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.special_id, p.avatar_url, p.discord_username
    FROM public.profiles p
   WHERE p.id = _id AND auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.get_opponent_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_opponent_profile(uuid) TO authenticated;
