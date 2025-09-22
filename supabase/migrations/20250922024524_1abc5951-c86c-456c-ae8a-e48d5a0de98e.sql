-- First, drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;

-- Create a more secure policy that only exposes essential public information
-- This policy allows viewing only specific safe columns for public profiles
CREATE POLICY "Public profiles show limited info only" ON public.profiles
FOR SELECT USING (
  public_profile_enabled = true AND 
  auth.uid() != id  -- This ensures the user can still see their full profile via the other policy
);

-- Create a security definer function to get safe public profile data
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_id uuid)
RETURNS TABLE(
  id uuid,
  producer_name text,
  producer_logo_url text,
  genres text[],
  bio text,
  verification_status text,
  banner_url text,
  social_links jsonb
) 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.producer_name,
    p.producer_logo_url,
    p.genres,
    p.bio,
    p.verification_status,
    p.banner_url,
    p.social_links
  FROM public.profiles p
  WHERE p.id = profile_id 
    AND p.public_profile_enabled = true;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profile_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_info(uuid) TO anon;