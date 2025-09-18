import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Upload, Search, TrendingUp, Music, Users, Star, Instagram, Twitter, Youtube } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
export default function Landing() {
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
  const featuredProducers = [{
    id: 1,
    name: "SoundWave",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop&crop=face",
    packTitle: "Trap Vibes Vol. 3",
    plays: "2.1K"
  }, {
    id: 2,
    name: "BeatMaker Pro",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    packTitle: "R&B Essentials",
    plays: "3.4K"
  }, {
    id: 3,
    name: "DrumlineKing",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    packTitle: "Hip Hop Heat",
    plays: "1.8K"
  }, {
    id: 4,
    name: "MelodyMaster",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    packTitle: "Chill Vibes",
    plays: "4.2K"
  }];
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Music className="w-8 h-8 text-brand-blue" />
              <span className="text-2xl font-bold text-foreground">BeatPackz</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#discover" className="text-muted-foreground hover:text-foreground transition-colors">
                Discover Beats
              </a>
              <a href="#producers" className="text-muted-foreground hover:text-foreground transition-colors">
                Producers
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              {user && (
                <Button 
                  variant="ghost" 
                  onClick={() => navigate("/dashboard")} 
                  className="text-brand-blue hover:text-brand-blue-glow font-semibold"
                >
                  Dashboard
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <Button 
                  onClick={() => navigate("/dashboard")} 
                  className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6"
                >
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

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=1080&fit=crop')"
      }} />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-card/50" />
        
        <div className="relative container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
              Discover.{" "}
              <span className="bg-gradient-to-r from-brand-blue-deep to-brand-blue bg-clip-text text-transparent">Connect.</span>{" "}
              Create.
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Producers send beat packs. Artists find their sound. All on BeatPackz.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? (
                <Button 
                  size="lg" 
                  onClick={() => navigate("/dashboard")} 
                  className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-8 py-4 text-lg shadow-lg shadow-brand-blue/30"
                >
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-8 py-4 text-lg shadow-lg shadow-brand-blue/30">
                    Sign Up Free
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="border-brand-blue text-brand-blue hover:bg-gradient-to-r hover:from-brand-blue-deep hover:to-brand-blue hover:text-white px-8 py-4 text-lg">
                    Log In
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section id="discover" className="py-20 bg-card/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Featured Beat Packs
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover the hottest beats from top producers in the game
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducers.map(producer => <Card key={producer.id} className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border-border bg-card/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="relative mb-4">
                    <img src={producer.image} alt={producer.name} className="w-full h-48 object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center">
                      <Button size="icon" className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow">
                        <Play className="w-6 h-6 text-white" />
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {producer.name}
                  </h3>
                  <p className="text-muted-foreground mb-2">{producer.packTitle}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {producer.plays} plays
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-brand-blue text-brand-blue" />
                      <span className="text-sm text-foreground">4.9</span>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Why Choose BeatPackz?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The complete platform for music collaboration and discovery
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="w-20 h-20 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-blue/20 transition-colors">
                <Upload className="w-10 h-10 text-brand-blue" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">Upload & Send Packs</h3>
              <p className="text-muted-foreground leading-relaxed">
                Producers can send curated beat packs directly to artists, making collaboration seamless and efficient.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Search className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">Browse & Discover</h3>
              <p className="text-muted-foreground leading-relaxed">
                Artists explore an endless library of beats and connect with talented producers worldwide.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-secondary/20 transition-colors">
                <TrendingUp className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">Grow Your Sound</h3>
              <p className="text-muted-foreground leading-relaxed">
                Collaborate, buy, and build your career on BeatPackz with powerful networking and promotion tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call-to-Action Banner */}
      <section className="py-20 bg-gradient-to-r from-brand-blue/10 via-brand-blue-glow/5 to-brand-blue-deep/10">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Join BeatPackz Today
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Where Producers & Artists Meet
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-12 py-4 text-xl shadow-xl shadow-brand-blue/40">
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-card border-t border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <Music className="w-8 h-8 text-brand-blue" />
                <span className="text-2xl font-bold text-foreground">BeatPackz</span>
              </div>
              <p className="text-muted-foreground mb-6 max-w-md">
                The premier platform connecting producers and artists through curated beat packs and seamless collaboration tools.
              </p>
              <div className="flex space-x-4">
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand-blue">
                  <Instagram className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand-blue">
                  <Twitter className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand-blue">
                  <Youtube className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center">
            <p className="text-muted-foreground">
              © 2024 BeatPackz. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>;
}