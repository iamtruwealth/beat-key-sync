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
    const maybeRedirect = async () => {
      // If we landed here during a protected route refresh, restore destination
      const redirectTo = (() => { try { return sessionStorage.getItem('redirectTo'); } catch { return null; } })();
      if (redirectTo) {
        try { sessionStorage.removeItem('redirectTo'); } catch {}
        navigate(redirectTo, { replace: true });
        return;
      }

      // If authenticated on landing, route to proper dashboard
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        const role = (profile as any)?.role || 'artist';
        navigate(role === 'producer' ? '/producer-dashboard' : '/artist-dashboard', { replace: true });
      }
    };

    maybeRedirect();
  }, [user, navigate]);
  useEffect(() => {
    const fetchFeaturedBeats = async () => {
      try {
        // Get featured beat packs and their tracks instead of individual featured beats
        const { data, error } = await supabase
          .from('featured_beat_packs')
          .select(`
            beat_pack_id,
            beat_packs:beat_pack_id (
              id,
              name,
              description,
              artwork_url,
              user_id,
              profiles!beat_packs_user_id_fkey (producer_name, producer_logo_url)
            )
          `)
          .limit(6);

        if (error) throw error;
        
        // Transform the data to match the expected format
        const transformedData = data?.map(item => {
          const beatPack = item.beat_packs as any;
          return {
            id: beatPack?.id,
            title: beatPack?.name,
            description: beatPack?.description,
            artwork_url: beatPack?.artwork_url,
            producer: {
              producer_name: beatPack?.profiles?.producer_name,
              producer_logo_url: beatPack?.profiles?.producer_logo_url
            }
          };
        }).filter(item => item.id) || [];
        
        setFeaturedBeats(transformedData);
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