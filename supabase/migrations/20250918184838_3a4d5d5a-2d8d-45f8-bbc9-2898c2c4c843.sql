-- Add download_enabled field to beat_packs table
ALTER TABLE public.beat_packs 
ADD COLUMN download_enabled boolean NOT NULL DEFAULT false;