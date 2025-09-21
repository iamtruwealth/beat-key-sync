-- Add only the missing foreign key constraints
-- Check which constraints already exist and add the missing ones
DO $$
BEGIN
    -- Add foreign key for beats.producer_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'beats_producer_id_fkey'
    ) THEN
        ALTER TABLE beats 
        ADD CONSTRAINT beats_producer_id_fkey 
        FOREIGN KEY (producer_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for beat_packs.user_id if it doesn't exist  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'beat_packs_user_id_fkey'
    ) THEN
        ALTER TABLE beat_packs 
        ADD CONSTRAINT beat_packs_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;