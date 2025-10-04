-- Fix security warning: Set search_path for update_updated_at_column function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate all triggers
CREATE TRIGGER update_artist_epk_profiles_updated_at BEFORE UPDATE ON public.artist_epk_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_epk_modules_updated_at BEFORE UPDATE ON public.epk_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fan_subscription_tiers_updated_at BEFORE UPDATE ON public.fan_subscription_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fan_subscriptions_updated_at BEFORE UPDATE ON public.fan_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_artist_exclusive_posts_updated_at BEFORE UPDATE ON public.artist_exclusive_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();