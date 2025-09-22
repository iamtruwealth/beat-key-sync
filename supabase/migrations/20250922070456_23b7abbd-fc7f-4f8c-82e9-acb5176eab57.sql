-- Create function to update user verification status (only for master admin)
CREATE OR REPLACE FUNCTION public.update_user_verification(
  user_id_param uuid,
  verification_status_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  admin_email text;
BEGIN
  -- Get the email of the requesting user
  SELECT email INTO admin_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if the requesting user is the master admin
  IF admin_email != 'iamtruwealth@gmail.com' THEN
    RAISE EXCEPTION 'Only the master admin can update verification status';
  END IF;
  
  -- Update the verification status
  UPDATE public.profiles
  SET 
    verification_status = verification_status_param,
    updated_at = now()
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$function$;

-- Create function to get all profiles for admin management
CREATE OR REPLACE FUNCTION public.get_all_profiles_for_admin()
RETURNS TABLE(
  id uuid,
  username text,
  producer_name text,
  first_name text,
  last_name text,
  producer_logo_url text,
  verification_status text,
  role user_role,
  created_at timestamp with time zone,
  public_profile_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- Check if the requesting user is the master admin
  SELECT 
    p.id,
    p.username,
    p.producer_name,
    p.first_name,
    p.last_name,
    p.producer_logo_url,
    p.verification_status,
    p.role,
    p.created_at,
    p.public_profile_enabled
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'iamtruwealth@gmail.com'
  )
  ORDER BY p.created_at DESC;
$function$;