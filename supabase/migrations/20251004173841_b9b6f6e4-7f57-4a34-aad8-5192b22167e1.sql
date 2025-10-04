-- Create or replace RPC to fetch public artist profiles based on roles
CREATE OR REPLACE FUNCTION public.get_public_artist_profiles()
RETURNS TABLE(
  id uuid,
  username text,
  producer_name text,
  producer_logo_url text,
  verification_status text,
  genres text[],
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.producer_name,
    p.producer_logo_url,
    p.verification_status,
    p.genres,
    p.bio
  FROM public.profiles p
  WHERE p.public_profile_enabled = true
    AND (
      public.has_role(p.id, 'artist'::public.user_role)
      OR (p.role = 'artist'::public.user_role)
    )
  ORDER BY p.created_at DESC;
$$;