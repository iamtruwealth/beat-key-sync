-- Create function to increment beat play count
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE beats 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = beat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment beat download count
CREATE OR REPLACE FUNCTION increment_beat_download_count(beat_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE beats 
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = beat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment beat pack play count
CREATE OR REPLACE FUNCTION increment_beat_pack_play_count(pack_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE beat_packs 
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = pack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_beat_play_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_beat_download_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_beat_pack_play_count(uuid) TO authenticated;

-- Grant execute permissions to anonymous users for public content
GRANT EXECUTE ON FUNCTION increment_beat_play_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_beat_download_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_beat_pack_play_count(uuid) TO anon;