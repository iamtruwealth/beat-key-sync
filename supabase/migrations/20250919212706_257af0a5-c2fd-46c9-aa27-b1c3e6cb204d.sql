-- Add IP tracking and signup attempts tables for account creation limits

-- Add IP address tracking to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Create signup attempts tracking table
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  success BOOLEAN DEFAULT false
);

-- Enable RLS on signup_attempts
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for signup_attempts (system managed, no user access needed)
CREATE POLICY "Service role can manage signup attempts" 
ON public.signup_attempts 
FOR ALL 
USING (false); -- Only service role can access this table

-- Create index for efficient IP-based queries
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time 
ON public.signup_attempts(ip_address, attempted_at);

-- Create index for IP-based profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_ip_address 
ON public.profiles(ip_address) WHERE ip_address IS NOT NULL;