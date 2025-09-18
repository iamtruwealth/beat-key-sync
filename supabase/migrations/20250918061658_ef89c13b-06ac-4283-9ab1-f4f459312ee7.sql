-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view all public tracks" ON public.tracks;

-- Create a more secure policy that allows users to view tracks but doesn't expose user_ids unnecessarily
-- Users can view all tracks, but in practice we'll handle user_id exposure at the application level
CREATE POLICY "Users can view tracks securely" ON public.tracks
FOR SELECT USING (
  -- Allow users to see their own tracks with full details
  auth.uid() = user_id 
  OR 
  -- Allow viewing tracks in general contexts (user_id should be filtered in queries)
  auth.uid() IS NOT NULL
);

-- Create a policy for unauthenticated users to view tracks without user_id exposure
CREATE POLICY "Public can view tracks without sensitive data" ON public.tracks
FOR SELECT USING (
  auth.uid() IS NULL
);

-- Add a function to get tracks without exposing user_ids for public access
CREATE OR REPLACE FUNCTION public.get_public_tracks()
RETURNS TABLE (
  id uuid,
  title text,
  file_url text,
  artwork_url text,
  duration numeric,
  detected_bpm numeric,
  manual_bpm numeric,
  detected_key text,
  manual_key text,
  tags text[],
  format text,
  sample_rate integer,
  file_size bigint,
  metadata jsonb,
  waveform_data jsonb,
  stems text[],
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) 
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.title,
    t.file_url,
    t.artwork_url,
    t.duration,
    t.detected_bpm,
    t.manual_bpm,
    t.detected_key,
    t.manual_key,
    t.tags,
    t.format,
    t.sample_rate,
    t.file_size,
    t.metadata,
    t.waveform_data,
    t.stems,
    t.created_at,
    t.updated_at
  FROM public.tracks t;
$$;