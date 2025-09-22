-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE beats 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = beat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_beat_download_count(beat_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE beats 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = beat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_beat_pack_play_count(pack_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE beat_packs 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = pack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;