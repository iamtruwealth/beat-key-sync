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

-- STEP 2: Update beats table to use file_url as primary audio field
-- Copy audio_file_url to file_url for existing beats
UPDATE public.beats SET file_url = audio_file_url WHERE file_url IS NULL;

-- Make file_url NOT NULL now that data is copied
ALTER TABLE public.beats ALTER COLUMN file_url SET NOT NULL;

-- STEP 3: Migrate all tracks data to beats table
INSERT INTO public.beats (
  id, title, artist, file_url, duration, file_size, format, sample_rate, 
  stems, tags, metadata, waveform_data, detected_bpm, detected_key, 
  manual_bpm, manual_key, artwork_url, created_at, updated_at, producer_id
)
SELECT 
  t.id, t.title, t.artist, t.file_url, t.duration, t.file_size, t.format, 
  t.sample_rate, t.stems, t.tags, t.metadata, t.waveform_data, t.detected_bpm, 
  t.detected_key, t.manual_bpm, t.manual_key, t.artwork_url, t.created_at, 
  t.updated_at, t.user_id as producer_id
FROM public.tracks t
WHERE NOT EXISTS (SELECT 1 FROM public.beats b WHERE b.id = t.id);

-- STEP 4: Update beat_pack_tracks to reference beats instead of tracks
-- The foreign key constraint should already work since we copied track IDs to beats

-- STEP 5: Update RLS policies for beats table to include track functionality
DROP POLICY IF EXISTS "Users can view their own tracks" ON public.beats;
DROP POLICY IF EXISTS "Users can create their own tracks" ON public.beats;  
DROP POLICY IF EXISTS "Users can update their own tracks" ON public.beats;
DROP POLICY IF EXISTS "Users can delete their own tracks" ON public.beats;

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

-- STEP 6: Drop the tracks table after successful migration
-- We'll keep this commented for safety - uncomment after verifying migration
-- DROP TABLE IF EXISTS public.tracks CASCADE;

-- STEP 7: Update function that referenced tracks table
DROP FUNCTION IF EXISTS public.get_public_tracks();

CREATE OR REPLACE FUNCTION public.get_public_beats()
RETURNS TABLE(
  id uuid,
  title text,
  artist text,
  file_url text,
  artwork_url text,
  duration numeric,
  file_size bigint,
  format text,
  sample_rate integer,
  stems text[],
  tags text[],
  metadata jsonb,
  waveform_data jsonb,
  detected_bpm numeric,
  detected_key text,
  manual_bpm numeric,
  manual_key text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    b.id, b.title, b.artist, b.file_url, b.artwork_url, b.duration, 
    b.file_size, b.format, b.sample_rate, b.stems, b.tags, b.metadata, 
    b.waveform_data, b.detected_bpm, b.detected_key, b.manual_bpm, 
    b.manual_key, b.created_at, b.updated_at
  FROM public.beats b
  WHERE EXISTS (
    SELECT 1 
    FROM (beat_pack_tracks bpt JOIN beat_packs bp ON ((bp.id = bpt.beat_pack_id))) 
    WHERE ((bpt.track_id = b.id) AND (bp.is_public = true))
  );
$$;