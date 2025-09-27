import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { MetaTags } from "@/components/MetaTags";

export default function About() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

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

  const navigateToUserDashboard = () => {
    if (user?.user_metadata?.role === 'artist') {
      navigate('/artist-dashboard');
    } else {
      navigate('/producer-dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MetaTags 
        title="About BeatPackz | The Ultimate Platform for Music Producers"
        description="Learn how BeatPackz revolutionizes music production. Upload beats, get AI analysis, set prices, track sales, and network with producers. Turn your music into a professional storefront."
        image="/assets/beat-packz-social-image.png"
        url="https://beatpackz.com/about"
      />
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/")}>
              <video src="/logo.mp4" className="w-8 h-8" autoPlay loop muted playsInline />
              <span className="text-2xl font-bold text-foreground">BeatPackz</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => navigate("/#discover")} className="text-muted-foreground hover:text-foreground transition-colors">
                Discover Beats
              </button>
              <button onClick={() => navigate("/pricing")} className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </button>
              {user && (
                <Button variant="ghost" onClick={navigateToUserDashboard} className="text-brand-blue hover:text-brand-blue-glow font-semibold">
                  Dashboard
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <Button onClick={navigateToUserDashboard} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate("/auth")} className="text-foreground hover:text-brand-blue">
                    Log In
                  </Button>
                  <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                    Sign Up Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="relative py-20 px-4 text-center bg-gradient-to-r from-brand-blue-deep to-brand-blue overflow-hidden mt-16">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            About BeatPackz
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8">
            The Ultimate Platform for Music Producers
          </p>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")} 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-semibold px-8 py-3"
          >
            Get Started Today
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-xl border">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
              Our Story
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
              <p className="text-lg md:text-xl mb-6">
                Beatpackz is the ultimate platform for music producers to showcase, sell, and share their beats professionally. Upload your beats and beat packs once, and our AI automatically analyzes each file to detect BPM and key, making your music easier to discover.
              </p>
              <p className="text-lg md:text-xl mb-6">
                Set your own prices or offer free downloads, and share interactive beat pack links that work seamlessly on phones, tablets, and computers — complete with an audio player, pricing, and download availability.
              </p>
              <p className="text-lg md:text-xl mb-6">
                Track your sales and revenue in real-time, request payouts through Stripe, PayPal, Venmo, or Cash App, and network with other producers via our messaging system.
              </p>
              <p className="text-lg md:text-xl font-semibold text-foreground">
                Beatpackz.store turns simple file sharing into a professional, automated, revenue-generating storefront, saving you time, boosting sales, and giving your music the exposure it deserves.
              </p>
            </div>
            
            <div className="text-center mt-12">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-12 py-4 text-xl shadow-xl shadow-brand-blue/40"
              >
                Join BeatPackz Today
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}