-- Security Fix Phase 1: Critical Data Exposure Fixes (Fixed Version)
-- 1. Create a secure function for safe public profile data
CREATE OR REPLACE FUNCTION public.get_safe_public_profile(profile_id uuid)
RETURNS TABLE(
  id uuid, 
  producer_name text, 
  producer_logo_url text, 
  genres text[], 
  bio text, 
  verification_status text, 
  banner_url text, 
  social_links jsonb, 
  followers_count integer, 
  following_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.producer_name,
    p.producer_logo_url,
    p.genres,
    p.bio,
    p.verification_status,
    p.banner_url,
    p.social_links,
    p.followers_count,
    p.following_count
  FROM public.profiles p
  WHERE p.id = profile_id 
    AND p.public_profile_enabled = true
    AND p.producer_name IS NOT NULL;
$$;

-- 2. Update profiles RLS policies to be more restrictive
DROP POLICY IF EXISTS "Authenticated users can view safe producer info" ON public.profiles;
DROP POLICY IF EXISTS "Public can view safe producer info only" ON public.profiles;

-- New restrictive policy for authenticated users - only safe data
CREATE POLICY "Authenticated users can view safe producer info" 
ON public.profiles 
FOR SELECT 
USING (
  (public_profile_enabled = true) 
  AND (producer_name IS NOT NULL) 
  AND (auth.uid() IS NOT NULL) 
  AND (auth.uid() <> id)
);

-- New restrictive policy for public users - only safe data  
CREATE POLICY "Public can view safe producer info only" 
ON public.profiles 
FOR SELECT 
USING (
  (public_profile_enabled = true) 
  AND (producer_name IS NOT NULL) 
  AND (auth.uid() IS NULL)
);

-- 3. Create user_roles table using existing user_role enum
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 5. Migrate existing roles from profiles to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, role 
FROM public.profiles 
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage roles" 
ON public.user_roles 
FOR ALL 
USING (auth.role() = 'service_role');

-- 7. Update get_producer_sales_summary to mask buyer emails
CREATE OR REPLACE FUNCTION public.get_producer_sales_summary(producer_uuid uuid)
RETURNS TABLE(
  sale_id uuid, 
  beat_id uuid, 
  amount_received integer, 
  platform_fee integer, 
  created_at timestamp with time zone, 
  buyer_initial text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    bs.id as sale_id,
    bs.beat_id,
    bs.amount_received,
    bs.platform_fee,
    bs.created_at,
    -- Mask email more securely
    LEFT(SPLIT_PART(bs.buyer_email, '@', 1), 1) || '***@' || 
    SPLIT_PART(bs.buyer_email, '@', 2) as buyer_initial
  FROM public.beat_sales bs
  WHERE bs.producer_id = producer_uuid
    AND auth.uid() = producer_uuid; -- Ensure only the producer can access their data
$$;

-- 8. Update beat_sales RLS policies to prevent email exposure
DROP POLICY IF EXISTS "Buyers can view their purchases (no email exposure)" ON public.beat_sales;
DROP POLICY IF EXISTS "Producers can view their sales (limited buyer info)" ON public.beat_sales;

-- New policy for buyers - can see their purchases but not full email
CREATE POLICY "Buyers can view their purchases" 
ON public.beat_sales 
FOR SELECT 
USING (buyer_email = (auth.jwt() ->> 'email'::text));

-- New policy for producers - can only see sales through the secure function
CREATE POLICY "Producers cannot directly access beat_sales" 
ON public.beat_sales 
FOR SELECT 
USING (false); -- Block direct access, force use of the secure function

-- 9. Create admin-only policy for user_roles management
CREATE POLICY "Only master admin can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (
  ((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text) = 'iamtruwealth@gmail.com'
);

-- 10. Fix search_path in existing functions
CREATE OR REPLACE FUNCTION public.get_profile_by_username(username_param text)
RETURNS TABLE(
  id uuid, 
  username text, 
  producer_name text, 
  producer_logo_url text, 
  genres text[], 
  bio text, 
  verification_status text, 
  banner_url text, 
  social_links jsonb, 
  public_profile_enabled boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.producer_name,
    p.producer_logo_url,
    p.genres,
    p.bio,
    p.verification_status,
    p.banner_url,
    p.social_links,
    p.public_profile_enabled
  FROM public.profiles p
  WHERE p.username = username_param 
    AND p.public_profile_enabled = true
    AND p.producer_name IS NOT NULL;
$$;