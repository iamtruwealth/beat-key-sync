-- Migration to handle existing accounts without artist/producer names
-- For existing accounts that don't have a producer_name or artist name, use their username

-- Update existing producer accounts that don't have a producer_name set
UPDATE public.profiles 
SET producer_name = username
WHERE role = 'producer' 
  AND (producer_name IS NULL OR producer_name = '') 
  AND username IS NOT NULL 
  AND username != '';

-- Update existing artist accounts that don't have a first_name set  
UPDATE public.profiles 
SET first_name = username
WHERE role = 'artist' 
  AND (first_name IS NULL OR first_name = '') 
  AND username IS NOT NULL 
  AND username != '';

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.producer_name IS 'Producer display name, automatically populated from username if not provided during signup';
COMMENT ON COLUMN public.profiles.first_name IS 'Artist display name (first name), automatically populated from username if not provided during signup';