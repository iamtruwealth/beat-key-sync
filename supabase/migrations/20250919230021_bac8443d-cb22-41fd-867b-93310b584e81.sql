-- STEP 1: Add missing fields from tracks table to beats table to merge schemas
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS artist TEXT;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS duration NUMERIC;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS sample_rate INTEGER;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS stems TEXT[];
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS waveform_data JSONB;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS detected_bpm NUMERIC;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS detected_key TEXT;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS manual_bpm NUMERIC;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS manual_key TEXT;

-- STEP 2: Fix null audio_file_url issue and update beats table
-- First, temporarily allow audio_file_url to be null
ALTER TABLE public.beats ALTER COLUMN audio_file_url DROP NOT NULL;

-- Copy audio_file_url to file_url for existing beats (only where audio_file_url is not null)
UPDATE public.beats SET file_url = audio_file_url WHERE audio_file_url IS NOT NULL AND file_url IS NULL;

-- For beats without audio_file_url, use a placeholder or set from existing file_url
UPDATE public.beats SET audio_file_url = COALESCE(file_url, '') WHERE audio_file_url IS NULL;

-- Now make both fields not null
ALTER TABLE public.beats ALTER COLUMN audio_file_url SET NOT NULL;
ALTER TABLE public.beats ALTER COLUMN file_url SET NOT NULL;

-- STEP 3: Migrate all tracks data to beats table
INSERT INTO public.beats (
  id, title, artist, file_url, duration, file_size, format, sample_rate, 
  stems, tags, metadata, waveform_data, detected_bpm, detected_key, 
  manual_bpm, manual_key, artwork_url, created_at, updated_at, producer_id,
  audio_file_url, is_free, price_cents
)
SELECT 
  t.id, t.title, t.artist, t.file_url, t.duration, t.file_size, t.format, 
  t.sample_rate, t.stems, t.tags, t.metadata, t.waveform_data, t.detected_bpm, 
  t.detected_key, t.manual_bpm, t.manual_key, t.artwork_url, t.created_at, 
  t.updated_at, t.user_id as producer_id,
  t.file_url as audio_file_url, true as is_free, 0 as price_cents
FROM public.tracks t
WHERE NOT EXISTS (SELECT 1 FROM public.beats b WHERE b.id = t.id);

-- STEP 4: Update RLS policies for beats table to include track functionality
DROP POLICY IF EXISTS "Users can view their own tracks" ON public.beats;
DROP POLICY IF EXISTS "Users can create their own tracks" ON public.beats;  
DROP POLICY IF EXISTS "Users can update their own tracks" ON public.beats;
DROP POLICY IF EXISTS "Users can delete their own tracks" ON public.beats;

-- Remove existing policies first
DROP POLICY IF EXISTS "Anyone can view public beats" ON public.beats;
DROP POLICY IF EXISTS "Producers can manage their own beats" ON public.beats;
DROP POLICY IF EXISTS "Producers can view their own beats" ON public.beats;
DROP POLICY IF EXISTS "Public beats in beat packs can be viewed" ON public.beats;

-- Comprehensive RLS policies for merged beats table
CREATE POLICY "Users can view their own beats" 
ON public.beats 
FOR SELECT 
USING (auth.uid() = producer_id);

CREATE POLICY "Users can create their own beats" 
ON public.beats 
FOR INSERT 
WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "Users can update their own beats" 
ON public.beats 
FOR UPDATE 
USING (auth.uid() = producer_id);

CREATE POLICY "Users can delete their own beats" 
ON public.beats 
FOR DELETE 
USING (auth.uid() = producer_id);

-- Public viewing policies for beats in beat packs
CREATE POLICY "Public beats in beat packs can be viewed" 
ON public.beats 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1 
  FROM (beat_pack_tracks bpt JOIN beat_packs bp ON ((bp.id = bpt.beat_pack_id))) 
  WHERE ((bpt.track_id = beats.id) AND (bp.is_public = true))
));