-- Update existing profiles without producer_name to use their username
UPDATE public.profiles
SET producer_name = username
WHERE producer_name IS NULL 
  AND username IS NOT NULL;