-- Add username column to profiles table with unique constraint
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE;

-- Add check constraint for username format (no spaces, alphanumeric + underscore/hyphen)
ALTER TABLE public.profiles 
ADD CONSTRAINT username_format_check 
CHECK (username ~ '^[a-zA-Z0-9_-]+$');

-- Create index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Create function to get profile by username
CREATE OR REPLACE FUNCTION public.get_profile_by_username(username_param text)
RETURNS TABLE(
  id uuid,
  username text,
  producer_name text,
  producer_logo_url text,
  genres text[],
  bio text,
  verification_status text,
  banner_url text,
  social_links jsonb,
  public_profile_enabled boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    p.id,
    p.username,
    p.producer_name,
    p.producer_logo_url,
    p.genres,
    p.bio,
    p.verification_status,
    p.banner_url,
    p.social_links,
    p.public_profile_enabled
  FROM public.profiles p
  WHERE p.username = username_param 
    AND p.public_profile_enabled = true
    AND p.producer_name IS NOT NULL;
$function$;

-- Create function to check username availability
CREATE OR REPLACE FUNCTION public.check_username_availability(username_param text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE username = username_param
  );
$function$;