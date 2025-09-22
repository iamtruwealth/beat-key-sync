import { useState, useEffect } from "react";
import { AudioProvider } from "@/contexts/AudioContext";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { FuturisticNavigation } from "@/components/futuristic/FuturisticNavigation";
import { FuturisticHero } from "@/components/futuristic/FuturisticHero";
import { FuturisticFooter } from "@/components/futuristic/FuturisticFooter";
import { InteractiveBeatPreview } from "@/components/futuristic/InteractiveBeatPreview";
import { FuturisticBeatPackCarousel } from "@/components/futuristic/FuturisticBeatPackCarousel";
import { GlassMorphismSection } from "@/components/futuristic/GlassMorphismSection";
import { ScrollAnimationWrapper } from "@/components/futuristic/ScrollAnimationWrapper";
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

      {/* Featured Beats Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6 relative z-10">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="gradient-text">Featured</span>{" "}
                <span className="text-neon-cyan">Producers</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Discover the hottest tracks from our top-rated producers
              </p>
            </div>
          </ScrollAnimationWrapper>

          {loadingFeatured ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 glass-morphism rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredBeats.map((beat, index) => (
                <ScrollAnimationWrapper 
                  key={beat.id} 
                  animation="scale-in" 
                  delay={index * 100}
                >
                  <InteractiveBeatPreview 
                    beat={{
                      id: beat.id,
                      title: beat.title,
                      producer: beat.producer?.display_name || "Unknown Producer",
                      price: beat.price || 0,
                      preview_url: beat.preview_url,
                      artwork_url: beat.artwork_url
                    }}
                  />
                </ScrollAnimationWrapper>
              ))}
            </div>
          )}

          <ScrollAnimationWrapper className="text-center mt-12">
            <Button 
              size="lg"
              onClick={() => navigate("/explore")}
              className="bg-gradient-to-r from-neon-magenta to-neon-purple hover:from-neon-magenta-glow hover:to-neon-purple text-white neon-glow-hover transform hover:scale-105 transition-all duration-300 px-8 py-4 text-lg"
            >
              Explore All Beats
            </Button>
          </ScrollAnimationWrapper>
        </div>
      </section>

      <FuturisticBeatPackCarousel />
      <FuturisticFooter />
    </div>
  );
}