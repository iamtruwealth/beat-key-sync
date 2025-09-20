-- Allow unauthenticated users to view public profiles (for producer names)
CREATE POLICY "Anyone can view public profiles" 
ON public.profiles 
FOR SELECT 
USING (public_profile_enabled = true);

-- Update beat pack tracks policy to allow unauthenticated access to public packs
DROP POLICY "Authenticated users can view beat pack tracks for public packs" ON public.beat_pack_tracks;
CREATE POLICY "Anyone can view tracks for public beat packs" 
ON public.beat_pack_tracks 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1 FROM beat_packs bp 
  WHERE ((bp.id = beat_pack_tracks.beat_pack_id) AND (bp.is_public = true))
));

-- Update tracks policy to allow unauthenticated access to public tracks
DROP POLICY "Authenticated users can view tracks in public beat packs" ON public.tracks;
CREATE POLICY "Anyone can view tracks in public beat packs" 
ON public.tracks 
FOR SELECT 
USING ((auth.uid() = user_id) OR (EXISTS ( 
  SELECT 1 FROM (beat_pack_tracks bpt JOIN beat_packs bp ON ((bp.id = bpt.beat_pack_id))) 
  WHERE ((bpt.track_id = tracks.id) AND (bp.is_public = true))
)));

-- Update beats policy to allow unauthenticated access to public beats
DROP POLICY "Authenticated users can view beats in public beat packs" ON public.beats;
CREATE POLICY "Anyone can view beats in public beat packs" 
ON public.beats 
FOR SELECT 
USING ((auth.uid() = producer_id) OR (EXISTS ( 
  SELECT 1 FROM (beat_pack_tracks bpt JOIN beat_packs bp ON ((bp.id = bpt.beat_pack_id))) 
  WHERE ((bpt.track_id = beats.id) AND (bp.is_public = true))
)));