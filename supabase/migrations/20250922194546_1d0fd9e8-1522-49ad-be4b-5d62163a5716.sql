-- Add repost functionality to posts table
ALTER TABLE public.posts 
ADD COLUMN repost_of uuid REFERENCES public.posts(id) ON DELETE CASCADE;

-- Add index for better performance on repost queries
CREATE INDEX idx_posts_repost_of ON public.posts(repost_of);

-- Update RLS policies to allow viewing reposts
-- The existing policies should already handle this since reposts are just posts