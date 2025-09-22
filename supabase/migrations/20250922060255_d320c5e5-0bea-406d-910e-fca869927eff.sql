-- Grant execute permissions on get_public_profile_info to anonymous users
GRANT EXECUTE ON FUNCTION public.get_public_profile_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile_info(uuid) TO authenticated;

-- Also ensure the profiles table allows anonymous users to see public profiles
DROP POLICY IF EXISTS "Public profiles show limited info only" ON public.profiles;

CREATE POLICY "Anonymous users can view public producer info" 
ON public.profiles 
FOR SELECT 
TO anon
USING (public_profile_enabled = true AND producer_name IS NOT NULL);

CREATE POLICY "Authenticated users can view public producer info" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public_profile_enabled = true AND producer_name IS NOT NULL AND auth.uid() <> id);

-- Keep the existing policy for users viewing their own profiles
-- (This should already exist from previous migrations)