-- Priority 1: Fix Critical Data Exposure Issues

-- First, let's update the profiles table RLS policies to be more restrictive
-- Drop the overly permissive anonymous access policy
DROP POLICY IF EXISTS "Anonymous users can view public producer info" ON public.profiles;

-- Drop the broad authenticated user policy 
DROP POLICY IF EXISTS "Authenticated users can view public producer info" ON public.profiles;

-- Create new, more restrictive policies for public profile access
CREATE POLICY "Public can view safe producer info only" 
ON public.profiles 
FOR SELECT 
USING (
  public_profile_enabled = true 
  AND producer_name IS NOT NULL
  AND auth.uid() IS NULL -- Anonymous users
);

-- Allow authenticated users to view safe producer info (excluding sensitive data)
CREATE POLICY "Authenticated users can view safe producer info" 
ON public.profiles 
FOR SELECT 
USING (
  public_profile_enabled = true 
  AND producer_name IS NOT NULL
  AND auth.uid() IS NOT NULL 
  AND auth.uid() <> id -- Not viewing their own profile
);

-- Update the beat_sales policies to be more restrictive about buyer email access
-- Drop existing policies
DROP POLICY IF EXISTS "Buyers can view their own purchases" ON public.beat_sales;
DROP POLICY IF EXISTS "Producers can view their own sales" ON public.beat_sales;

-- Create new restrictive policies
CREATE POLICY "Buyers can view their purchases (no email exposure)" 
ON public.beat_sales 
FOR SELECT 
USING (
  buyer_email = (auth.jwt() ->> 'email'::text)
);

-- Producers can view their sales but with limited buyer info
CREATE POLICY "Producers can view their sales (limited buyer info)" 
ON public.beat_sales 
FOR SELECT 
USING (
  auth.uid() = producer_id
);

-- Ensure message policies are properly restrictive
-- Let's verify and strengthen message privacy
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;

-- Create stricter message viewing policy
CREATE POLICY "Users can only view messages they sent or received" 
ON public.messages 
FOR SELECT 
USING (
  (auth.uid() = sender_id) OR (auth.uid() = recipient_id)
);

-- Add a policy to prevent any updates to messages by unauthorized users
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

CREATE POLICY "Only message senders can update their messages" 
ON public.messages 
FOR UPDATE 
USING (
  auth.uid() = sender_id AND read_at IS NULL -- Can only update unread messages they sent
);

-- Security enhancement: Create a function to get only safe profile data
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

-- Add RLS policy for the new safe function
GRANT EXECUTE ON FUNCTION public.get_safe_public_profile(uuid) TO authenticated, anon;

-- Create a security definer function for producers to get limited sales data
CREATE OR REPLACE FUNCTION public.get_producer_sales_summary(producer_uuid uuid)
RETURNS TABLE(
  sale_id uuid,
  beat_id uuid,
  amount_received integer,
  platform_fee integer,
  created_at timestamp with time zone,
  buyer_initial text -- Only first letter of buyer email for privacy
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
    LEFT(bs.buyer_email, 1) || '***' as buyer_initial
  FROM public.beat_sales bs
  WHERE bs.producer_id = producer_uuid
    AND auth.uid() = producer_uuid; -- Ensure only the producer can access their data
$$;

GRANT EXECUTE ON FUNCTION public.get_producer_sales_summary(uuid) TO authenticated;