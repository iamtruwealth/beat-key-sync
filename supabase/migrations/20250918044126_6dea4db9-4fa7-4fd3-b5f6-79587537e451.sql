-- Add artwork_url column to tracks table
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artwork_url TEXT;