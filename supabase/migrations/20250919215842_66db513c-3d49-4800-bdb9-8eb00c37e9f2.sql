-- Create beats table
CREATE TABLE public.beats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  title TEXT NOT NULL,
  audio_file_url TEXT NOT NULL,
  price_cents INTEGER DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  artwork_url TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  genre TEXT,
  bpm INTEGER,
  key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create beat_sales table
CREATE TABLE public.beat_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  buyer_email TEXT NOT NULL,
  amount_received INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payout_requests table
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL,
  payout_method TEXT NOT NULL, -- 'stripe', 'paypal', 'venmo', 'cashapp'
  payout_details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add stripe_account_id and payout_info to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS payout_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_earnings_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_balance_cents INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beat_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for beats
CREATE POLICY "Producers can manage their own beats" ON public.beats
  FOR ALL USING (auth.uid() = producer_id);

CREATE POLICY "Anyone can view public beats" ON public.beats
  FOR SELECT USING (true);

-- RLS Policies for beat_sales
CREATE POLICY "Producers can view their own sales" ON public.beat_sales
  FOR SELECT USING (auth.uid() = producer_id);

-- RLS Policies for payout_requests
CREATE POLICY "Producers can manage their own payout requests" ON public.payout_requests
  FOR ALL USING (auth.uid() = producer_id);

-- Create updated_at trigger for beats
CREATE TRIGGER update_beats_updated_at
  BEFORE UPDATE ON public.beats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_beats_producer_id ON public.beats(producer_id);
CREATE INDEX idx_beats_is_free ON public.beats(is_free);
CREATE INDEX idx_beats_created_at ON public.beats(created_at DESC);
CREATE INDEX idx_beat_sales_producer_id ON public.beat_sales(producer_id);
CREATE INDEX idx_beat_sales_created_at ON public.beat_sales(created_at DESC);
CREATE INDEX idx_payout_requests_producer_id ON public.payout_requests(producer_id);
CREATE INDEX idx_payout_requests_status ON public.payout_requests(status);