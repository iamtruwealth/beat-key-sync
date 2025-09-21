-- Add genre field to beat_packs table
ALTER TABLE public.beat_packs 
ADD COLUMN genre text;