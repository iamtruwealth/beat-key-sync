import { useState, useEffect } from "react";
import { AudioProvider } from "@/contexts/AudioContext";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { FuturisticNavigation } from "@/components/futuristic/FuturisticNavigation";
import { FuturisticHero } from "@/components/futuristic/FuturisticHero";
import { FuturisticFooter } from "@/components/futuristic/FuturisticFooter";
import { InteractiveBeatPreview } from "@/components/futuristic/InteractiveBeatPreview";
import { FuturisticBeatPackCarousel } from "@/components/futuristic/FuturisticBeatPackCarousel";
import { FuturisticProducerCarousel } from "@/components/futuristic/FuturisticProducerCarousel";
import { GlassMorphismSection } from "@/components/futuristic/GlassMorphismSection";
import { ScrollAnimationWrapper } from "@/components/futuristic/ScrollAnimationWrapper";
import { PromoVideoSection } from "@/components/futuristic/PromoVideoSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Music, 
  Users, 
  TrendingUp, 
  Zap, 
  Shield, 
  Star,
  HeadphonesIcon,
  Mic,
  Radio
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetaTags } from "@/components/MetaTags";

export default function Landing() {
  return (
    <AudioProvider>
      <FuturisticLandingContent />
    </AudioProvider>
  );
}

function FuturisticLandingContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [featuredBeats, setFeaturedBeats] = useState<any[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchFeaturedBeats = async () => {
      try {
        const { data, error } = await supabase
          .from('beats')
          .select(`*,producer:profiles(display_name, avatar_url)`)
          .eq('is_featured', true)
          .limit(6);

        if (error) throw error;
        setFeaturedBeats(data || []);
      } catch (error) {
        console.error('Error fetching featured beats:', error);
      } finally {
        setLoadingFeatured(false);
      }
    };

    fetchFeaturedBeats();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <MetaTags 
        title="BeatPackz - The Future of Beat Production | Premium Beats & Producers"
        description="Discover premium beats, connect with top producers, and elevate your music with our cutting-edge platform. Join the future of beat production today."
        image="/assets/beat-packz-social-image.png"
      />

      <FuturisticNavigation />
      <FuturisticHero />
      <PromoVideoSection />


      <FuturisticProducerCarousel />
      <FuturisticBeatPackCarousel />
      <FuturisticFooter />
    </div>
  );
}