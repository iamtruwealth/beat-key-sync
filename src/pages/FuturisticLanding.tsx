import { useEffect, useState } from "react";
import { AudioProvider } from "@/contexts/AudioContext";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { FuturisticNavigation } from "@/components/futuristic/FuturisticNavigation";
import { FuturisticHero } from "@/components/futuristic/FuturisticHero";
import { FuturisticFooter } from "@/components/futuristic/FuturisticFooter";
import { InteractiveBeatPreview } from "@/components/futuristic/InteractiveBeatPreview";
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

export default function FuturisticLanding() {
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
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
              display_name: beatPack?.profiles?.producer_name,
              avatar_url: beatPack?.profiles?.producer_logo_url
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

  const features = [
    {
      icon: Music,
      title: "Premium Beat Library",
      description: "Access thousands of high-quality beats from top producers worldwide",
      color: "neon-cyan"
    },
    {
      icon: Users,
      title: "Connect with Producers",
      description: "Collaborate directly with talented beatmakers and expand your network",
      color: "neon-magenta"
    },
    {
      icon: TrendingUp,
      title: "Advanced Analytics",
      description: "Track your performance with real-time insights and detailed metrics",
      color: "electric-blue"
    },
    {
      icon: Zap,
      title: "Instant Downloads",
      description: "Get your beats instantly with our lightning-fast download system",
      color: "neon-purple"
    },
    {
      icon: Shield,
      title: "Secure Licensing",
      description: "All beats come with clear licensing terms for worry-free usage",
      color: "neon-green"
    },
    {
      icon: Star,
      title: "Exclusive Content",
      description: "Get early access to exclusive beats and limited-edition releases",
      color: "neon-cyan"
    }
  ];

  const testimonials = [
    {
      name: "DJ Eclipse",
      role: "Hip-Hop Producer",
      content: "BeatPackz revolutionized my workflow. The quality is unmatched!",
      avatar: "/assets/soundwave-logo.jpg",
      rating: 5
    },
    {
      name: "Sarah Martinez",
      role: "Independent Artist",
      content: "Found my signature sound through this platform. Game changer!",
      avatar: "/assets/melodymaster-logo.jpg",
      rating: 5
    },
    {
      name: "Mike Johnson",
      role: "Music Producer",
      content: "The collaboration features are incredible. Highly recommended!",
      avatar: "/assets/beatmaker-logo.jpg",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <MetaTags 
        title="BeatPackz - The Future of Beat Production | Premium Beats & Producers"
        description="Discover premium beats, connect with top producers, and elevate your music with our cutting-edge platform. Join the future of beat production today."
        image="/assets/beat-packz-social-image.png"
      />

      {/* Navigation */}
      <FuturisticNavigation />

      {/* Hero Section */}
      <FuturisticHero />

      {/* Featured Beats Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/10 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="gradient-text">Featured</span>{" "}
                <span className="text-neon-cyan">Beats</span>
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

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="text-electric-blue">Why Choose</span>{" "}
                <span className="gradient-text">BeatPackz?</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Experience the future of music production with our cutting-edge platform
              </p>
            </div>
          </ScrollAnimationWrapper>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <ScrollAnimationWrapper 
                key={feature.title} 
                animation="slide-up" 
                delay={index * 150}
              >
                <Card className="group glass-morphism border-2 border-border hover:border-electric-blue transition-all duration-300 transform hover:scale-105 hover:-translate-y-2">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full bg-${feature.color}/20 flex items-center justify-center group-hover:animate-glow-pulse transition-all duration-300`}>
                      <feature.icon className={`w-8 h-8 text-${feature.color}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-neon-cyan transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </ScrollAnimationWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="text-neon-magenta">What Creators</span>{" "}
                <span className="gradient-text">Say</span>
              </h2>
            </div>
          </ScrollAnimationWrapper>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <ScrollAnimationWrapper 
                key={testimonial.name} 
                animation="scale-in" 
                delay={index * 200}
              >
                <GlassMorphismSection variant="gradient" className="text-center hover:scale-105 transition-transform duration-300">
                  <div className="space-y-4">
                    <img 
                      src={testimonial.avatar} 
                      alt={testimonial.name}
                      className="w-16 h-16 rounded-full mx-auto border-2 border-neon-cyan"
                    />
                    <div className="flex justify-center space-x-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-neon-cyan fill-current" />
                      ))}
                    </div>
                    <p className="text-lg italic text-foreground">
                      "{testimonial.content}"
                    </p>
                    <div>
                      <h4 className="font-semibold text-neon-cyan">{testimonial.name}</h4>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </GlassMorphismSection>
              </ScrollAnimationWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <ScrollAnimationWrapper>
            <GlassMorphismSection variant="neon" className="text-center max-w-4xl mx-auto">
              <div className="space-y-8">
                <div className="flex justify-center space-x-4 mb-8">
                  <div className="w-12 h-12 bg-neon-cyan/20 rounded-full flex items-center justify-center animate-float">
                    <HeadphonesIcon className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <div className="w-12 h-12 bg-neon-magenta/20 rounded-full flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
                    <Mic className="w-6 h-6 text-neon-magenta" />
                  </div>
                  <div className="w-12 h-12 bg-electric-blue/20 rounded-full flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                    <Radio className="w-6 h-6 text-electric-blue" />
                  </div>
                </div>

                <h2 className="text-4xl md:text-6xl font-bold">
                  <span className="gradient-text">Ready to Create</span>
                  <br />
                  <span className="text-neon-cyan">Something Amazing?</span>
                </h2>
                
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Join thousands of artists and producers who are already creating their next hit on BeatPackz
                </p>

                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Button 
                    size="lg"
                    onClick={() => navigate("/auth")}
                    className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow neon-glow-hover transform hover:scale-105 transition-all duration-300 px-8 py-4 text-lg ripple"
                  >
                    Start Your Journey
                  </Button>
                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/explore")}
                    className="border-2 border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background hover:shadow-lg hover:shadow-neon-magenta/30 transition-all duration-300 px-8 py-4 text-lg"
                  >
                    Explore Now
                  </Button>
                </div>
              </div>
            </GlassMorphismSection>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* Footer */}
      <FuturisticFooter />
    </div>
  );
}