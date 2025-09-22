-- Set master admin account as permanently verified
UPDATE public.profiles 
SET verification_status = 'verified', updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'iamtruwealth@gmail.com'
);

-- Create a trigger to ensure master admin stays verified
CREATE OR REPLACE FUNCTION public.ensure_master_admin_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  admin_email text;
BEGIN
  -- Get the email for this user ID
  SELECT email INTO admin_email
  FROM auth.users
  WHERE id = NEW.id;
  
  -- If this is the master admin, ensure they stay verified
  IF admin_email = 'iamtruwealth@gmail.com' THEN
    NEW.verification_status = 'verified';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to run before any profile update
DROP TRIGGER IF EXISTS ensure_master_admin_verified_trigger ON public.profiles;
CREATE TRIGGER ensure_master_admin_verified_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_master_admin_verified();