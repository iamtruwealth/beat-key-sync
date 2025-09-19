-- Update tracks RLS policy to allow viewing tracks in public beat packs
DROP POLICY IF EXISTS "Users can view their own tracks" ON public.tracks;
DROP POLICY IF EXISTS "Public tracks in beat packs can be viewed" ON public.tracks;

-- Create new policies for tracks
CREATE POLICY "Users can view their own tracks" 
ON public.tracks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Public tracks in beat packs can be viewed" 
ON public.tracks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM beat_pack_tracks bpt
    JOIN beat_packs bp ON bp.id = bpt.beat_pack_id
    WHERE bpt.track_id = tracks.id 
    AND bp.is_public = true
  )
);

-- Update beats RLS policy to allow viewing beats in public beat packs
DROP POLICY IF EXISTS "Anyone can view public beats" ON public.beats;
DROP POLICY IF EXISTS "Public beats in beat packs can be viewed" ON public.beats;

-- Create new policies for beats
CREATE POLICY "Producers can view their own beats" 
ON public.beats 
FOR SELECT 
USING (auth.uid() = producer_id);

CREATE POLICY "Public beats in beat packs can be viewed" 
ON public.beats 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM beat_pack_tracks bpt
    JOIN beat_packs bp ON bp.id = bpt.beat_pack_id
    WHERE bpt.track_id = beats.id 
    AND bp.is_public = true
  )
);

CREATE POLICY "Anyone can view public beats" 
ON public.beats 
FOR SELECT 
USING (true);