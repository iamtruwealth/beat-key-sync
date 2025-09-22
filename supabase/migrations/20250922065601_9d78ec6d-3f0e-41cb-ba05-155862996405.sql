-- Update the handle_new_user function to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role, producer_logo_url, username)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'artist'),
    NEW.raw_user_meta_data ->> 'artist_logo',
    NEW.raw_user_meta_data ->> 'username'
  );
  RETURN NEW;
END;
$function$;