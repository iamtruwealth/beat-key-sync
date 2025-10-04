-- Artist EPK (Electronic Press Kit) System

-- EPK Profiles Table
CREATE TABLE IF NOT EXISTS public.artist_epk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  is_published BOOLEAN DEFAULT false,
  custom_domain TEXT,
  theme_settings JSONB DEFAULT '{"primaryColor": "#8B5CF6", "accentColor": "#EC4899"}'::jsonb,
  seo_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(artist_id)
);

-- EPK Modules/Blocks Table (for drag-and-drop modular content)
CREATE TABLE IF NOT EXISTS public.epk_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epk_profile_id UUID NOT NULL REFERENCES public.artist_epk_profiles(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL, -- 'header', 'bio', 'music_player', 'press_photos', etc.
  module_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  custom_title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fan Subscription Tiers
CREATE TABLE IF NOT EXISTS public.fan_subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL, -- 'fan', 'super_fan', 'ultra_fan'
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  perks JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fan Subscriptions
CREATE TABLE IF NOT EXISTS public.fan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.fan_subscription_tiers(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'unpaid'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Paywalled Content/Posts
CREATE TABLE IF NOT EXISTS public.artist_exclusive_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT, -- 'image', 'video', 'audio', 'download'
  required_tier TEXT NOT NULL, -- 'fan', 'super_fan', 'ultra_fan'
  preview_text TEXT,
  preview_image_url TEXT,
  is_published BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription Revenue Tracking
CREATE TABLE IF NOT EXISTS public.fan_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.fan_subscriptions(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL, -- 12% of amount
  artist_earnings_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Welcome Message Templates
CREATE TABLE IF NOT EXISTS public.subscription_welcome_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  subject TEXT DEFAULT 'Welcome to My Fan Club!',
  message_body TEXT NOT NULL,
  include_download_links BOOLEAN DEFAULT false,
  download_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(artist_id, tier_name)
);

-- Enable Row Level Security
ALTER TABLE public.artist_epk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epk_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_exclusive_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_welcome_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for EPK Profiles
CREATE POLICY "Artists can manage their own EPK"
  ON public.artist_epk_profiles
  FOR ALL
  USING (auth.uid() = artist_id);

CREATE POLICY "Anyone can view published EPKs"
  ON public.artist_epk_profiles
  FOR SELECT
  USING (is_published = true);

-- RLS Policies for EPK Modules
CREATE POLICY "Artists can manage their EPK modules"
  ON public.epk_modules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_epk_profiles
      WHERE id = epk_modules.epk_profile_id
      AND artist_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view enabled modules of published EPKs"
  ON public.epk_modules
  FOR SELECT
  USING (
    is_enabled = true
    AND EXISTS (
      SELECT 1 FROM public.artist_epk_profiles
      WHERE id = epk_modules.epk_profile_id
      AND is_published = true
    )
  );

-- RLS Policies for Subscription Tiers
CREATE POLICY "Artists can manage their subscription tiers"
  ON public.fan_subscription_tiers
  FOR ALL
  USING (auth.uid() = artist_id);

CREATE POLICY "Anyone can view active tiers"
  ON public.fan_subscription_tiers
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for Fan Subscriptions
CREATE POLICY "Fans can view their own subscriptions"
  ON public.fan_subscriptions
  FOR SELECT
  USING (auth.uid() = fan_id);

CREATE POLICY "Artists can view their fan subscriptions"
  ON public.fan_subscriptions
  FOR SELECT
  USING (auth.uid() = artist_id);

CREATE POLICY "System can manage subscriptions"
  ON public.fan_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for Exclusive Posts
CREATE POLICY "Artists can manage their exclusive posts"
  ON public.artist_exclusive_posts
  FOR ALL
  USING (auth.uid() = artist_id);

CREATE POLICY "Subscribed fans can view tier-appropriate posts"
  ON public.artist_exclusive_posts
  FOR SELECT
  USING (
    is_published = true
    AND (
      -- Check if user has active subscription at required tier or higher
      EXISTS (
        SELECT 1 FROM public.fan_subscriptions fs
        JOIN public.fan_subscription_tiers fst ON fs.tier_id = fst.id
        WHERE fs.fan_id = auth.uid()
        AND fs.artist_id = artist_exclusive_posts.artist_id
        AND fs.status = 'active'
        AND (
          (artist_exclusive_posts.required_tier = 'fan' AND fst.tier_name IN ('fan', 'super_fan', 'ultra_fan'))
          OR (artist_exclusive_posts.required_tier = 'super_fan' AND fst.tier_name IN ('super_fan', 'ultra_fan'))
          OR (artist_exclusive_posts.required_tier = 'ultra_fan' AND fst.tier_name = 'ultra_fan')
        )
      )
    )
  );

-- RLS Policies for Subscription Payments
CREATE POLICY "Artists can view their subscription revenue"
  ON public.fan_subscription_payments
  FOR SELECT
  USING (auth.uid() = artist_id);

CREATE POLICY "System can insert payments"
  ON public.fan_subscription_payments
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for Welcome Messages
CREATE POLICY "Artists can manage their welcome messages"
  ON public.subscription_welcome_messages
  FOR ALL
  USING (auth.uid() = artist_id);

-- Create indexes for performance
CREATE INDEX idx_epk_profiles_slug ON public.artist_epk_profiles(slug);
CREATE INDEX idx_epk_profiles_artist ON public.artist_epk_profiles(artist_id);
CREATE INDEX idx_epk_modules_profile ON public.epk_modules(epk_profile_id);
CREATE INDEX idx_epk_modules_position ON public.epk_modules(epk_profile_id, position);
CREATE INDEX idx_fan_subs_fan ON public.fan_subscriptions(fan_id);
CREATE INDEX idx_fan_subs_artist ON public.fan_subscriptions(artist_id);
CREATE INDEX idx_fan_subs_status ON public.fan_subscriptions(status);
CREATE INDEX idx_exclusive_posts_artist ON public.artist_exclusive_posts(artist_id);
CREATE INDEX idx_sub_payments_artist ON public.fan_subscription_payments(artist_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artist_epk_profiles_updated_at BEFORE UPDATE ON public.artist_epk_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_epk_modules_updated_at BEFORE UPDATE ON public.epk_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fan_subscription_tiers_updated_at BEFORE UPDATE ON public.fan_subscription_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fan_subscriptions_updated_at BEFORE UPDATE ON public.fan_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_artist_exclusive_posts_updated_at BEFORE UPDATE ON public.artist_exclusive_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();