import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StickyHeader from "@/components/layout/StickyHeader";
import { ScrollAnimationWrapper } from "@/components/futuristic/ScrollAnimationWrapper";
import { GlassMorphismSection } from "@/components/futuristic/GlassMorphismSection";
import { MetaTags } from "@/components/MetaTags";
import { 
  Search, 
  Music, 
  MessageSquare, 
  User, 
  Play,
  Heart,
  Star,
  Users,
  Zap,
  TrendingUp
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import verifiedBadge from '@/assets/verified-badge.png';

interface Producer {
  id: string;
  producer_name?: string;
  producer_logo_url?: string;
  genres?: string[];
  bio?: string;
  verification_status?: string;
  banner_url?: string;
  social_links?: any;
}

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  user_id: string;
  created_at: string;
  is_public: boolean;
  download_enabled: boolean;
  producer?: Producer;
}

export default function BrowseProducers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [producers, setProducers] = useState<Producer[]>([]);
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [activeTab, setActiveTab] = useState<"producers" | "beatpacks">("producers");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Load producers - get IDs first
    const { data: producerIds } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'producer')
      .eq('public_profile_enabled', true)
      .order('track_upload_count', { ascending: false });
    
    if (producerIds) {
      // Use secure function to get public profile data
      const producerData = await Promise.all(
        producerIds.map(async ({ id }) => {
          const { data } = await supabase.rpc('get_public_profile_info', { profile_id: id });
          return data?.[0];
        })
      );
      setProducers(producerData.filter(Boolean) || []);
    }

    // Load public beat packs
    const { data: beatPacksData } = await supabase
      .from('beat_packs')
      .select(`
        *,
        producer:profiles!beat_packs_user_id_fkey(
          id,
          producer_name,
          producer_logo_url,
          genres
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    
    setBeatPacks(beatPacksData || []);
    setLoading(false);
  };

  const filteredProducers = producers.filter(producer => {
    const searchLower = searchQuery.toLowerCase();
    return (
      producer.producer_name?.toLowerCase().includes(searchLower) ||
      producer.genres?.some(genre => genre.toLowerCase().includes(searchLower))
    );
  });

  const filteredBeatPacks = beatPacks.filter(pack => {
    const searchLower = searchQuery.toLowerCase();
    return (
      pack.name.toLowerCase().includes(searchLower) ||
      pack.description?.toLowerCase().includes(searchLower) ||
      pack.producer?.producer_name?.toLowerCase().includes(searchLower) ||
      pack.producer?.genres?.some(genre => genre.toLowerCase().includes(searchLower))
    );
  });

  const handleMessageProducer = (producerId: string) => {
    navigate(`/messages?user=${producerId}`);
  };

  const handleViewBeatPack = (packId: string) => {
    navigate(`/pack/${packId}`);
  };

  const handleViewProducer = (producerId: string) => {
    navigate(`/producer/${producerId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StickyHeader />
        <main className="container mx-auto px-6 pt-24 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 glass-morphism rounded-2xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <MetaTags 
        title="Browse Producers & Beat Packs | BeatPackz - Connect with Top Producers"
        description="Discover talented music producers and their latest beat packs. Connect, collaborate, and find the perfect sound for your next project."
        image="/assets/beat-packz-social-image.png"
      />

      <StickyHeader />

      <main className="container mx-auto px-6 pt-24 pb-16">
        {/* Hero Section */}
        <ScrollAnimationWrapper>
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="gradient-text">Discover</span>{" "}
              <span className="text-neon-cyan">Producers</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Connect with talented beatmakers, explore their latest work, and collaborate on your next hit
            </p>
            
            {/* Stats */}
            <div className="flex justify-center space-x-8 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-neon-cyan">{producers.length}+</div>
                <div className="text-sm text-muted-foreground">Producers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-neon-magenta">{beatPacks.length}+</div>
                <div className="text-sm text-muted-foreground">Beat Packs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-electric-blue">24/7</div>
                <div className="text-sm text-muted-foreground">Support</div>
              </div>
            </div>
          </div>
        </ScrollAnimationWrapper>

        {/* Search Section */}
        <ScrollAnimationWrapper>
          <GlassMorphismSection className="mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-5 w-5 text-neon-cyan" />
              <Input
                placeholder="Search producers, beat packs, or genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-lg glass-morphism border-neon-cyan/30 focus:border-neon-cyan bg-background/50"
              />
            </div>
          </GlassMorphismSection>
        </ScrollAnimationWrapper>

        {/* Tabs */}
        <ScrollAnimationWrapper>
          <div className="flex justify-center gap-4 mb-12">
            <Button
              onClick={() => setActiveTab("producers")}
              variant={activeTab === "producers" ? "default" : "outline"}
              className={`px-8 py-3 text-lg transition-all duration-300 ${
                activeTab === "producers"
                  ? "bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow neon-glow-hover"
                  : "border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-background"
              }`}
            >
              <Users className="w-5 h-5 mr-2" />
              Producers ({filteredProducers.length})
            </Button>
            <Button
              onClick={() => setActiveTab("beatpacks")}
              variant={activeTab === "beatpacks" ? "default" : "outline"}
              className={`px-8 py-3 text-lg transition-all duration-300 ${
                activeTab === "beatpacks"
                  ? "bg-gradient-to-r from-neon-magenta to-neon-purple hover:from-neon-magenta-glow hover:to-neon-purple text-white neon-glow-hover"
                  : "border-2 border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background"
              }`}
            >
              <Music className="w-5 h-5 mr-2" />
              Beat Packs ({filteredBeatPacks.length})
            </Button>
          </div>
        </ScrollAnimationWrapper>

        {/* Producers Tab */}
        {activeTab === "producers" && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducers.map((producer, index) => (
              <ScrollAnimationWrapper key={producer.id} animation="scale-in" delay={index * 100}>
                <Card className="group glass-morphism border-2 border-border hover:border-neon-cyan transition-all duration-300 transform hover:scale-105 hover:-translate-y-2">
                  <CardHeader className="text-center relative overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-electric-blue/5 group-hover:from-neon-cyan/10 group-hover:to-electric-blue/10 transition-all duration-300" />
                    
                    <div className="relative z-10">
                      <Avatar className="w-20 h-20 mx-auto mb-4 border-4 border-neon-cyan/30 group-hover:border-neon-cyan transition-all duration-300">
                        <AvatarImage src={producer.producer_logo_url} />
                        <AvatarFallback className="text-2xl bg-gradient-to-br from-neon-cyan/20 to-electric-blue/20 text-neon-cyan">
                          {producer.producer_name?.[0] || "P"}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CardTitle className="group-hover:text-neon-cyan transition-colors">
                          {producer.producer_name || 'Unknown Producer'}
                        </CardTitle>
                        {producer.verification_status === 'verified' && (
                          <img src={verifiedBadge} alt="Verified" className="w-5 h-5" />
                        )}
                      </div>
                      
                      <CardDescription className="line-clamp-3 group-hover:text-foreground transition-colors">
                        {producer.bio || "Passionate music producer creating unique beats and soundscapes"}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {producer.genres?.slice(0, 3).map((genre) => (
                        <Badge 
                          key={genre} 
                          className="bg-electric-blue/20 text-electric-blue border border-electric-blue/30 hover:bg-electric-blue hover:text-background transition-all"
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue-glow neon-glow-hover"
                        onClick={() => handleViewProducer(producer.id)}
                      >
                        <User className="w-4 h-4 mr-1" />
                        View Profile
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background"
                        onClick={() => handleMessageProducer(producer.id)}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </ScrollAnimationWrapper>
            ))}
            
            {filteredProducers.length === 0 && (
              <div className="col-span-full text-center py-16">
                <ScrollAnimationWrapper>
                  <GlassMorphismSection className="max-w-md mx-auto">
                    <User className="w-16 h-16 text-neon-cyan mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neon-cyan mb-2">No Producers Found</h3>
                    <p className="text-muted-foreground">Try adjusting your search terms</p>
                  </GlassMorphismSection>
                </ScrollAnimationWrapper>
              </div>
            )}
          </div>
        )}

        {/* Beat Packs Tab */}
        {activeTab === "beatpacks" && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredBeatPacks.map((pack, index) => (
              <ScrollAnimationWrapper key={pack.id} animation="scale-in" delay={index * 100}>
                <Card className="group glass-morphism border-2 border-border hover:border-neon-magenta transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 overflow-hidden">
                  <div className="relative aspect-square">
                    {pack.artwork_url ? (
                      <img 
                        src={pack.artwork_url} 
                        alt={pack.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neon-magenta/20 to-neon-purple/20 flex items-center justify-center">
                        <Music className="w-16 h-16 text-neon-magenta" />
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                      <Button 
                        size="sm"
                        className="bg-neon-magenta/20 backdrop-blur-sm border border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-background neon-glow-hover"
                        onClick={() => handleViewBeatPack(pack.id)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Preview Pack
                      </Button>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg group-hover:text-neon-magenta transition-colors">
                      {pack.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {pack.description || "Explore this amazing collection of beats"}
                    </CardDescription>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="w-6 h-6 border border-electric-blue/30">
                        <AvatarImage src={pack.producer?.producer_logo_url} />
                        <AvatarFallback className="text-xs bg-electric-blue/20 text-electric-blue">
                          {pack.producer?.producer_name?.[0] || "P"}
                        </AvatarFallback>
                      </Avatar>
                      <Link 
                        to={`/producer/${pack.user_id}`}
                        className="text-sm text-muted-foreground hover:text-neon-cyan transition-colors"
                      >
                        {pack.producer?.producer_name || "Unknown Producer"}
                      </Link>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex gap-2 mb-4">
                      {pack.producer?.genres?.slice(0, 2).map((genre) => (
                        <Badge 
                          key={genre} 
                          className="bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-gradient-to-r from-neon-magenta to-neon-purple hover:from-neon-magenta-glow hover:to-neon-purple text-white neon-glow-hover"
                        onClick={() => handleViewBeatPack(pack.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-electric-blue text-electric-blue hover:bg-electric-blue hover:text-background"
                        onClick={() => handleMessageProducer(pack.user_id)}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </ScrollAnimationWrapper>
            ))}
            
            {filteredBeatPacks.length === 0 && (
              <div className="col-span-full text-center py-16">
                <ScrollAnimationWrapper>
                  <GlassMorphismSection className="max-w-md mx-auto">
                    <Music className="w-16 h-16 text-neon-magenta mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neon-magenta mb-2">No Beat Packs Found</h3>
                    <p className="text-muted-foreground">Try adjusting your search terms</p>
                  </GlassMorphismSection>
                </ScrollAnimationWrapper>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}