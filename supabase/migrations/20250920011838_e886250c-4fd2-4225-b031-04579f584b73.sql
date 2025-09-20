-- Add foreign key relationship between beat_packs and profiles
ALTER TABLE public.beat_packs 
ADD CONSTRAINT fk_beat_packs_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;