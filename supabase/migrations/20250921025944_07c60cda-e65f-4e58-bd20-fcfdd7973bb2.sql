-- Fix foreign key relationships and add missing constraints
-- Add foreign key constraint for beats.producer_id referencing profiles.id
ALTER TABLE beats 
ADD CONSTRAINT beats_producer_id_fkey 
FOREIGN KEY (producer_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key constraint for beat_packs.user_id referencing profiles.id  
ALTER TABLE beat_packs 
ADD CONSTRAINT beat_packs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update beat_pack_tracks to have proper foreign key
ALTER TABLE beat_pack_tracks 
ADD CONSTRAINT beat_pack_tracks_beat_pack_id_fkey 
FOREIGN KEY (beat_pack_id) REFERENCES beat_packs(id) ON DELETE CASCADE;

ALTER TABLE beat_pack_tracks 
ADD CONSTRAINT beat_pack_tracks_beat_id_fkey 
FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE;