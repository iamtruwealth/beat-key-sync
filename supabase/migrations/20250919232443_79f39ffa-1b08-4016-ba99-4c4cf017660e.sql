-- Fix the foreign key constraint for beat_pack_tracks to reference beats table
ALTER TABLE beat_pack_tracks 
DROP CONSTRAINT IF EXISTS beat_pack_tracks_track_id_fkey;

ALTER TABLE beat_pack_tracks 
ADD CONSTRAINT beat_pack_tracks_track_id_fkey 
FOREIGN KEY (track_id) REFERENCES beats(id) ON DELETE CASCADE;