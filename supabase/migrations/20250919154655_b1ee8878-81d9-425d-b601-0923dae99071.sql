-- Add subscription and usage tracking fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS track_upload_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS beat_pack_count integer DEFAULT 0;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);