-- Create producer subscription tiers table
CREATE TABLE IF NOT EXISTS public.producer_subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('bronze', 'silver', 'gold', 'platinum')),
  price_cents INTEGER NOT NULL,
  monthly_download_limit INTEGER NOT NULL DEFAULT 1,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  perks JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(producer_id, tier_name)
);

-- Create producer subscriptions table
CREATE TABLE IF NOT EXISTS public.producer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.producer_subscription_tiers(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  downloads_used INTEGER DEFAULT 0,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(fan_id, producer_id)
);

-- Create producer subscription payments table
CREATE TABLE IF NOT EXISTS public.producer_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.producer_subscriptions(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  producer_earnings_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.producer_subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_subscription_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for producer_subscription_tiers
CREATE POLICY "Anyone can view active tiers"
  ON public.producer_subscription_tiers
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Producers can manage their subscription tiers"
  ON public.producer_subscription_tiers
  FOR ALL
  USING (auth.uid() = producer_id);

-- RLS Policies for producer_subscriptions
CREATE POLICY "Fans can view their own subscriptions"
  ON public.producer_subscriptions
  FOR SELECT
  USING (auth.uid() = fan_id);

CREATE POLICY "Producers can view their fan subscriptions"
  ON public.producer_subscriptions
  FOR SELECT
  USING (auth.uid() = producer_id);

CREATE POLICY "System can manage subscriptions"
  ON public.producer_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for producer_subscription_payments
CREATE POLICY "Producers can view their subscription revenue"
  ON public.producer_subscription_payments
  FOR SELECT
  USING (auth.uid() = producer_id);

CREATE POLICY "System can insert payments"
  ON public.producer_subscription_payments
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX idx_producer_subscription_tiers_producer ON public.producer_subscription_tiers(producer_id);
CREATE INDEX idx_producer_subscriptions_fan ON public.producer_subscriptions(fan_id);
CREATE INDEX idx_producer_subscriptions_producer ON public.producer_subscriptions(producer_id);
CREATE INDEX idx_producer_subscription_payments_producer ON public.producer_subscription_payments(producer_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_producer_subscription_tiers_updated_at
  BEFORE UPDATE ON public.producer_subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_producer_subscriptions_updated_at
  BEFORE UPDATE ON public.producer_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();