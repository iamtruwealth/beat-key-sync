-- Add foreign key constraint between beat_sales and beats tables
ALTER TABLE beat_sales 
ADD CONSTRAINT beat_sales_beat_id_fkey 
FOREIGN KEY (beat_id) 
REFERENCES beats(id) 
ON DELETE CASCADE;