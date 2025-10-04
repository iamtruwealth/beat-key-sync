-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_public_artist_profiles();

-- Recreate with EPK information
CREATE OR REPLACE FUNCTION public.get_public_artist_profiles()
RETURNS TABLE(
  id uuid,
  username text,
  producer_name text,
  producer_logo_url text,
  verification_status text,
  genres text[],
  bio text,
  hometown text,
  social_links jsonb,
  epk_slug text,
  has_epk boolean
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
    p.bio,
    p.home_town as hometown,
    p.social_links,
    epk.slug as epk_slug,
    (epk.id IS NOT NULL AND epk.is_published = true) as has_epk
  FROM public.profiles p
  LEFT JOIN public.artist_epk_profiles epk ON epk.artist_id = p.id AND epk.is_published = true
  WHERE p.public_profile_enabled = true
    AND (
      public.has_role(p.id, 'artist'::public.user_role)
      OR (p.role = 'artist'::public.user_role)
    )
  ORDER BY p.created_at DESC;
$$;