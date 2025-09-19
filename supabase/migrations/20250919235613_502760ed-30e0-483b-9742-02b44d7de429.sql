-- First check existing policies and recreate them securely

-- Secure beats table - require authentication for public beat pack access
DROP POLICY IF EXISTS "Public beats in beat packs can be viewed" ON public.beats;
DROP POLICY IF EXISTS "Users can view beats in public beat packs" ON public.beats;

CREATE POLICY "Authenticated users can view beats in public beat packs" 
ON public.beats 
FOR SELECT 
USING (
  auth.uid() = producer_id OR 
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 
    FROM beat_pack_tracks bpt
    JOIN beat_packs bp ON bp.id = bpt.beat_pack_id
    WHERE bpt.track_id = beats.id 
    AND bp.is_public = true
  ))
);

-- Secure tracks table - require authentication for public beat pack access  
DROP POLICY IF EXISTS "Public tracks in beat packs can be viewed" ON public.tracks;
DROP POLICY IF EXISTS "Users can view tracks in public beat packs" ON public.tracks;

CREATE POLICY "Authenticated users can view tracks in public beat packs"
ON public.tracks
FOR SELECT
USING (
  auth.uid() = user_id OR
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 
    FROM beat_pack_tracks bpt
    JOIN beat_packs bp ON bp.id = bpt.beat_pack_id
    WHERE bpt.track_id = tracks.id 
    AND bp.is_public = true
  ))
);