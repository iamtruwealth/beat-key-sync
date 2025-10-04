-- Add exclusive_beat_ids field to artist_epk_profiles to store up to 10 exclusive beats for members
ALTER TABLE artist_epk_profiles 
ADD COLUMN IF NOT EXISTS exclusive_beat_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN artist_epk_profiles.exclusive_beat_ids IS 'Array of beat IDs (max 10) that are exclusive for subscribed fans';