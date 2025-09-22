import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Music, 
  MessageSquare, 
  User, 
  Play,
  Heart,
  Download,
  Share2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [activeTab, setActiveTab] = useState<"producers" | "beatpacks">("beatpacks");
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
      .eq('public_profile_enabled', true);
    
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Browse Producers & Beat Packs</h1>
        <p className="text-muted-foreground">Discover talented producers and their latest beat packs</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search producers, beat packs, or genres..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab("beatpacks")}
          className={`pb-2 px-1 border-b-2 transition-colors ${
            activeTab === "beatpacks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Beat Packs ({filteredBeatPacks.length})
        </button>
        <button
          onClick={() => setActiveTab("producers")}
          className={`pb-2 px-1 border-b-2 transition-colors ${
            activeTab === "producers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Producers ({filteredProducers.length})
        </button>
      </div>

      {/* Beat Packs Tab */}
      {activeTab === "beatpacks" && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBeatPacks.map((pack) => (
            <Card key={pack.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                {pack.artwork_url ? (
                  <img 
                    src={pack.artwork_url} 
                    alt={pack.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-12 h-12 text-primary" />
                )}
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{pack.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {pack.description || "No description available"}
                </CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={pack.producer?.producer_logo_url} />
                    <AvatarFallback>
                      {pack.producer?.producer_name?.[0] || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {pack.producer?.producer_name || "Unknown Producer"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2 mb-3">
                  {pack.producer?.genres?.slice(0, 2).map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleViewBeatPack(pack.id)}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleMessageProducer(pack.user_id)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Heart className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredBeatPacks.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No beat packs found matching your search</p>
            </div>
          )}
        </div>
      )}

      {/* Producers Tab */}
      {activeTab === "producers" && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducers.map((producer) => (
            <Card key={producer.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <Avatar className="w-16 h-16 mx-auto mb-3">
                  <AvatarImage src={producer.producer_logo_url} />
                  <AvatarFallback className="text-lg">
                    {producer.producer_name?.[0] || "P"}
                  </AvatarFallback>
                </Avatar>
                <CardTitle>
                  {producer.producer_name || 'Unknown Producer'}
                </CardTitle>
                <CardDescription className="line-clamp-3">
                  {producer.bio || "No bio available"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-4">
                  {producer.genres?.slice(0, 3).map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleMessageProducer(producer.id)}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Message
                  </Button>
                  <Button size="sm" variant="outline">
                    <User className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProducers.length === 0 && (
            <div className="col-span-full text-center py-12">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No producers found matching your search</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}