-- Remove the vulnerable policy that allows anonymous access to tracks
DROP POLICY IF EXISTS "Public can view tracks without sensitive data" ON public.tracks;

-- Update the existing authenticated user policy to be more restrictive
-- Only allow users to see their own tracks OR tracks that are explicitly marked as public
DROP POLICY IF EXISTS "Users can view tracks securely" ON public.tracks;

-- Create a new secure policy for authenticated users
CREATE POLICY "Users can view their own tracks" 
ON public.tracks 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add a policy for public tracks (only if we add a public flag later)
-- For now, all tracks are private to their creators