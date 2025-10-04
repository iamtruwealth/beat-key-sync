-- Create artist payment methods table
CREATE TABLE IF NOT EXISTS public.artist_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal', 'bank_transfer', 'stripe', 'cashapp', 'venmo', 'zelle')),
  account_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.artist_payment_methods ENABLE ROW LEVEL SECURITY;

-- Artists can manage their own payment methods
CREATE POLICY "Artists can manage their own payment methods"
  ON public.artist_payment_methods
  FOR ALL
  USING (auth.uid() = artist_id);

-- Create index for faster lookups
CREATE INDEX idx_artist_payment_methods_artist_id ON public.artist_payment_methods(artist_id);
CREATE INDEX idx_artist_payment_methods_primary ON public.artist_payment_methods(artist_id, is_primary) WHERE is_primary = true;

-- Trigger to update updated_at
CREATE TRIGGER update_artist_payment_methods_updated_at
  BEFORE UPDATE ON public.artist_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();