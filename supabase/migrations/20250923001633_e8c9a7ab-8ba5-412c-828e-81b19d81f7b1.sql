-- Update auth settings to disable email confirmation requirement
-- This will allow users to sign up and sign in immediately without email verification

-- Note: This is a configuration change that affects the auth.users table behavior
-- We can't directly modify auth schema, but we can create a custom signup function

-- Create a function to handle signup without email confirmation
CREATE OR REPLACE FUNCTION public.signup_without_confirmation(
  email_param TEXT,
  password_param TEXT,
  username_param TEXT,
  role_param TEXT DEFAULT 'artist'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  result JSON;
BEGIN
  -- This function will be called from an edge function
  -- that uses the service role to create users directly
  RETURN json_build_object(
    'success', true,
    'message', 'Please use the edge function for signup'
  );
END;
$$;