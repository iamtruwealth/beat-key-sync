-- Create function to increment beat download count and associated beat pack download counts
CREATE OR REPLACE FUNCTION public.increment_beat_and_pack_download_count(beat_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- First increment the individual beat's download count
  UPDATE beats 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = beat_id;
  
  -- Then increment download count for all beat packs that contain this beat
  -- by inserting records into beat_pack_downloads table for tracking
  INSERT INTO beat_pack_downloads (beat_pack_id, user_id, ip_address)
  SELECT DISTINCT bpt.beat_pack_id, auth.uid(), NULL
  FROM beat_pack_tracks bpt
  WHERE bpt.track_id = beat_id;
  
  -- Note: The beat pack download counts are calculated via COUNT in queries
  -- so inserting records here will automatically increase the count
END;
$function$