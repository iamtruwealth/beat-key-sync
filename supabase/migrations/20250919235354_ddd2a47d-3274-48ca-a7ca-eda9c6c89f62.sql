-- Fix critical security issues with publicly accessible tables

-- Remove overly permissive policies that allow public access to sensitive data
DROP POLICY IF EXISTS "Public beats in beat packs can be viewed" ON public.beats;
DROP POLICY IF EXISTS "Public tracks in beat packs can be viewed" ON public.tracks;

-- Create new secure policies for beats table
CREATE POLICY "Users can view beats in public beat packs" 
ON public.beats 
FOR SELECT 
USING (
  auth.uid() = producer_id OR 
  EXISTS (
    SELECT 1 
    FROM beat_pack_tracks bpt
    JOIN beat_packs bp ON bp.id = bpt.beat_pack_id
    WHERE bpt.track_id = beats.id 
    AND bp.is_public = true
    AND auth.uid() IS NOT NULL
  )
);

-- Create new secure policies for tracks table  
CREATE POLICY "Users can view tracks in public beat packs"
ON public.tracks
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 
    FROM beat_pack_tracks bpt
    JOIN beat_packs bp ON bp.id = bpt.beat_pack_id
    WHERE bpt.track_id = tracks.id 
    AND bp.is_public = true
    AND auth.uid() IS NOT NULL
  )
);

-- Secure beat pack views - only allow authenticated users
DROP POLICY IF EXISTS "Anyone can view beat pack views for public packs" ON public.beat_pack_views;
CREATE POLICY "Authenticated users can view beat pack views for public packs"
ON public.beat_pack_views
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 
    FROM beat_packs bp
    WHERE bp.id = beat_pack_views.beat_pack_id 
    AND (bp.is_public = true OR bp.user_id = auth.uid())
  )
);

-- Secure beat pack tracks - require authentication
DROP POLICY IF EXISTS "Users can view beat pack tracks for public packs" ON public.beat_pack_tracks;
CREATE POLICY "Authenticated users can view beat pack tracks for public packs"
ON public.beat_pack_tracks
FOR SELECT  
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 
    FROM beat_packs bp
    WHERE bp.id = beat_pack_tracks.beat_pack_id 
    AND (bp.is_public = true OR bp.user_id = auth.uid())
  )
);