-- Add foreign key constraint for posts.producer_id -> profiles.id
ALTER TABLE public.posts 
ADD CONSTRAINT posts_producer_id_fkey 
FOREIGN KEY (producer_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;