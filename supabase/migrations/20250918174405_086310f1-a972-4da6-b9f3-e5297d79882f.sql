-- Add producer_name field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN producer_name text;

-- Add artist field to tracks table for producer/artist name
ALTER TABLE public.tracks 
ADD COLUMN artist text;