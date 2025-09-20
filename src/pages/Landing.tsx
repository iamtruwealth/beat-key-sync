import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Upload, Search, TrendingUp, Music, Users, Star, Instagram, Twitter, Youtube, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useAudio, AudioProvider } from "@/contexts/AudioContext";
import soundwaveLogo from "@/assets/soundwave-logo.jpg";
import beatmakerLogo from "@/assets/beatmaker-logo.jpg";
import drumlinekingLogo from "@/assets/drumlineking-logo.jpg";
import melodymasterLogo from "@/assets/melodymaster-logo.jpg";
import { FeaturedPacksManager } from "@/components/admin/FeaturedPacksManager";
export default function Landing() {
  return <AudioProvider>
      <LandingContent />
    </AudioProvider>;
}
function LandingContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [featuredProducers, setFeaturedProducers] = useState<any[]>([]);
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const {
    currentTrack,
    isPlaying,
    loading,
    playTrack
  } = useAudio();
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setIsMasterAccount(sessionUser?.email === 'iamtruwealth@gmail.com');
    });

    // Listen for auth changes
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setIsMasterAccount(sessionUser?.email === 'iamtruwealth@gmail.com');
    });
    return () => subscription.unsubscribe();
  }, []);
  const navigateToUserDashboard = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      const {
        data: profile
      } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const role = profile?.role || 'artist';
      navigate(role === 'producer' ? '/producer-dashboard' : '/artist-dashboard');
    } catch (error) {
      // Fallback to artist dashboard if profile fetch fails
      navigate('/artist-dashboard');
    }
  };
  useEffect(() => {
    // Fetch featured beat packs
    const fetchFeaturedPacks = async () => {
      try {
        // Try to load curated featured packs first
        let beatPacks: any[] = [];
        const { data: featured } = await supabase
          .from('featured_beat_packs')
          .select('beat_pack_id, position, created_at')
          .order('position', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(4);

        if (featured && featured.length > 0) {
          const ids = featured.map(f => f.beat_pack_id);
          const { data: packs } = await supabase
            .from('beat_packs')
            .select('id, name, artwork_url, user_id')
            .in('id', ids)
            .eq('is_public', true);
          beatPacks = ids.map(id => packs?.find(p => p.id === id)).filter(Boolean) as any[];
        } else {
          const { data: packs } = await supabase
            .from('beat_packs')
            .select('id, name, artwork_url, user_id')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(4);
          beatPacks = packs || [];
        }

        if (beatPacks && beatPacks.length > 0) {
          // Get profiles for the users
          const userIds = beatPacks.map(pack => pack.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, producer_name, first_name')
            .in('id', userIds);

          // Get first track from each beat pack for audio preview
          const formattedPacks = await Promise.all(beatPacks.map(async (pack, index) => {
            const profile = profiles?.find(p => p.id === pack.user_id);
            
            // Get the first track from this beat pack
            const { data: packTracks } = await supabase
              .from('beat_pack_tracks')
              .select(`
                tracks!inner(id, title, file_url, artwork_url)
              `)
              .eq('beat_pack_id', pack.id)
              .order('position', { ascending: true })
              .limit(1);

            const firstTrack = packTracks?.[0]?.tracks as any;
            
            return {
              id: pack.id,
              name: profile?.producer_name || profile?.first_name || 'Producer',
              image: pack.artwork_url || soundwaveLogo,
              packTitle: pack.name,
              plays: `${Math.floor(Math.random() * 5000 + 1000)}`, // Demo play count
              preview_url: firstTrack?.file_url || "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
            };
          }));
          
          // Ensure trap pack is first if it exists
          const trapPackIndex = formattedPacks.findIndex(pack => 
            pack.packTitle.toLowerCase().includes('trap')
          );
          if (trapPackIndex > 0) {
            const trapPack = formattedPacks.splice(trapPackIndex, 1)[0];
            formattedPacks.unshift(trapPack);
          }
          
          setFeaturedProducers(formattedPacks);
        }
      } catch (error) {
        console.error('Error fetching beat packs:', error);
        // Fallback to hardcoded data if fetch fails
        setFeaturedProducers([
          {
            id: 1,
            name: "TruWealth",
            image: "https://lascsucrozzhbvlsddxg.supabase.co/storage/v1/object/public/artwork/d3ac8cb7-916a-47fe-bb66-9a541981809f/beat-packs/1343acc3-43c9-4cbb-a6eb-4d409e763832/artwork-1758171615448.gif",
            packTitle: "Trap Pack",
            plays: "5.2K",
            preview_url: "https://lascsucrozzhbvlsddxg.supabase.co/storage/v1/object/public/audio-files/d3ac8cb7-916a-47fe-bb66-9a541981809f/1758219057579-1%20elevated%20vibes%20196bpm%20c#m.mp3"
          },
          {
            id: 2,
            name: "SoundWave",
            image: soundwaveLogo,
            packTitle: "Trap Vibes Vol. 3",
            plays: "2.1K",
            preview_url: "https://lascsucrozzhbvlsddxg.supabase.co/storage/v1/object/public/audio-files/d3ac8cb7-916a-47fe-bb66-9a541981809f/1758219057579-1%20elevated%20vibes%20196bpm%20c#m.mp3"
          }
        ]);
      }
    };

    fetchFeaturedPacks();
  }, []);
  const handleProducerPlay = (producer: typeof featuredProducers[0], event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click when clicking play button
    console.log('Playing producer track:', producer.preview_url);
    const audioTrack = {
      id: producer.id.toString(),
      title: producer.packTitle,
      artist: producer.name,
      file_url: producer.preview_url,
      artwork_url: producer.image
    };
    playTrack(audioTrack);
  };

  const handleCardClick = (producer: typeof featuredProducers[0]) => {
    navigate(`/pack/${producer.id}`);
  };
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <video src="/logo.mp4" className="w-8 h-8" autoPlay loop muted playsInline />
              <span className="text-2xl font-bold text-foreground">BeatPackz</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#discover" className="text-muted-foreground hover:text-foreground transition-colors">
                Discover Beats
              </a>
              <a href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              {user && <Button variant="ghost" onClick={navigateToUserDashboard} className="text-brand-blue hover:text-brand-blue-glow font-semibold">
                  Dashboard
                </Button>}
            </div>

            <div className="flex items-center space-x-4">
              {user ? <Button onClick={navigateToUserDashboard} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                  Go to Dashboard
                </Button> : <>
                  <Button variant="ghost" onClick={() => navigate("/auth")} className="text-foreground hover:text-brand-blue">
                    Log In
                  </Button>
                  <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-6">
                    Sign Up Free
                  </Button>
                </>}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{
        backgroundImage: "url('/assets/hip-hop-collage-bg.png')"
      }} />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-card/50" />
        
        <div className="relative container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
              Discover.{" "}
              <span className="bg-gradient-to-r from-brand-blue-deep to-brand-blue bg-clip-text text-transparent">Connect.</span>{" "}
              Create.
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">Interactive beat packs, AI analysis, and instant payouts — built for producers.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? <Button size="lg" onClick={navigateToUserDashboard} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-8 py-4 text-lg shadow-lg shadow-brand-blue/30">
                  Go to Dashboard
                </Button> : <>
                  <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow text-white font-semibold px-8 py-4 text-lg shadow-lg shadow-brand-blue/30">
                    Sign Up Free
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="border-brand-blue text-brand-blue hover:bg-gradient-to-r hover:from-brand-blue-deep hover:to-brand-blue hover:text-white px-8 py-4 text-lg">
                    Log In
                  </Button>
                </>}
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section id="discover" className="py-20 bg-card/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-4">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                Featured Beat Packs
              </h2>
              {isMasterAccount && <FeaturedPacksManager />}
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover the hottest beats from top producers in the game
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducers.map(producer => {
            const isCurrentTrack = currentTrack?.id === producer.id.toString();
            const showPlayButton = !isCurrentTrack || !isPlaying;
            return <Card key={producer.id} className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border-border bg-card/80 backdrop-blur-sm" onClick={() => handleCardClick(producer)}>
                  <CardContent className="p-6">
                    <div className="relative mb-4">
                      <img src={producer.image} alt={producer.name} className="w-full h-48 object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center">
                        <Button size="icon" className="bg-gradient-to-r from-brand-blue-deep to-brand-blue hover:from-brand-blue hover:to-brand-blue-glow" onClick={(e) => handleProducerPlay(producer, e)} disabled={loading && isCurrentTrack}>
                          {loading && isCurrentTrack ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : showPlayButton ? <Play className="w-6 h-6 text-white" /> : <Pause className="w-6 h-6 text-white" />}
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
                </Card>;
          })}
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
            Upload your beats, set your price, share interactive beat packs, and get paid — all while tracking sales and connecting with other producers.
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
            Turn your beats into revenue — share, sell, and track your music all in one professional platform.
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
              <p className="text-muted-foreground mb-6 max-w-md">© 2025 BeatPackz. All rights reserved.</p>
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