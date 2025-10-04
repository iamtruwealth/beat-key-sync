-- Add artist_name column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS artist_name text;